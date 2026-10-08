const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const workflow = JSON.parse(execFileSync(process.env.PYTHON || 'python3', [
  '-c', 'import json,sys,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))',
  path.join(__dirname, '../workflows/select-runner.yml')
], { encoding: 'utf8' }));
const script = workflow.jobs.bootstrap.steps[0].with.script;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const execute = new AsyncFunction('core', 'github', 'context', 'process', 'Date',
  'performance', 'setTimeout', script);
const runner = (busy = false) => ({ status: 'online', busy,
  labels: ['self-hosted', 'macOS', 'ARM64'].map(name => ({ name })) });

async function run(overrides = {}, pages = [{ runners: [], total_count: 0 }], apiDelay = 0, started = 0) {
  let elapsed = started;
  let calls = 0;
  const output = {};
  const env = {
    PHASE: 'bootstrap', RUNNER_PREFERENCE: 'self-hosted-preferred',
    SELF_HOSTED_LABELS: '["self-hosted","macOS","ARM64"]',
    GITHUB_HOSTED_LABEL: 'ubuntu-latest', WAIT_MINUTES: '30',
    RUNNER_CHECK_TOKEN: 'test-token', IS_FORK_PULL_REQUEST: 'false',
    DEADLINE: '1800000', SCAN_STATUS: 'unavailable', CONTROLLER_KIND: 'github-hosted',
    CONTROLLER_LABELS: '["self-hosted","macOS","ARM64","par"]',
    ...overrides
  };
  await execute({ setOutput: (key, value) => { output[key] = value; }, notice: () => {} },
    { rest: { actions: { listSelfHostedRunnersForRepo: async request => {
      assert.ok(request.request.timeout > 0 && request.request.timeout <= 10000);
      const page = pages[Math.min(calls++, pages.length - 1)];
      elapsed += Math.min(apiDelay, request.request.timeout);
      if (apiDelay > request.request.timeout) throw new Error('Request timed out');
      if (page instanceof Error) throw page;
      return { data: page };
    } } } }, { repo: { owner: 'DatomerAB', repo: 'caller' } }, { env },
    { now: () => elapsed }, { now: () => elapsed },
    (callback, delay) => { elapsed += delay; callback(); });
  return { output, elapsed, calls };
}

test('bootstrap chooses idle self-hosted selector with case-insensitive labels', async () => {
  const result = await run({}, [{ runners: [runner()], total_count: 1 }]);
  assert.deepEqual(JSON.parse(result.output.selector_runs_on), ['self-hosted', 'macOS', 'ARM64']);
  assert.equal(result.output.scan_status, 'available');
  assert.equal(result.calls, 1);
});

test('bootstrap is brief when runner is busy', async () => {
  const result = await run({}, [{ runners: [runner(true)], total_count: 1 }]);
  assert.equal(result.output.selector_runs_on, '"ubuntu-latest"');
  assert.equal(result.calls, 1);
  assert.equal(result.elapsed, 0);
});

test('selector does not wait for its own occupied runner', async () => {
  const result = await run({ PHASE: 'select', CONTROLLER_KIND: 'self-hosted', SCAN_STATUS: 'available' });
  assert.equal(result.output.runner_kind, 'self-hosted');
  assert.equal(result.calls, 0);
});

test('matching self-hosted bootstrap needs neither hosted capacity nor a lookup token', async () => {
  const result = await run({ CONTROLLER_KIND: 'self-hosted', RUNNER_CHECK_TOKEN: '' });
  assert.equal(result.output.runner_kind, 'self-hosted');
  assert.equal(result.output.scan_status, 'available');
  assert.equal(result.calls, 0);
});

test('self-hosted selection remains self-hosted without a lookup token', async () => {
  const result = await run({ PHASE: 'select', CONTROLLER_KIND: 'self-hosted',
    SCAN_STATUS: 'available', RUNNER_CHECK_TOKEN: '' });
  assert.equal(result.output.runner_kind, 'self-hosted');
  assert.equal(result.calls, 0);
});

test('Mac controller cannot select itself for Windows work', async () => {
  const result = await run({ CONTROLLER_KIND: 'self-hosted', RUNNER_CHECK_TOKEN: '',
    SELF_HOSTED_LABELS: '["self-hosted","Windows","X64","jcwindows"]',
    GITHUB_HOSTED_LABEL: 'windows-2022' });
  assert.equal(result.output.runner_kind, 'github-hosted');
  assert.match(result.output.reason, /token/);
});

test('fork guard overrides the self-hosted-controller fast path', async () => {
  const result = await run({ CONTROLLER_KIND: 'self-hosted', IS_FORK_PULL_REQUEST: 'true' });
  assert.equal(result.output.runner_kind, 'github-hosted');
  assert.equal(result.calls, 0);
});

test('trusted bootstrap is not unconditionally assigned a hosted runner', () => {
  const bootstrapRunner = workflow.jobs.bootstrap['runs-on'];
  assert.match(bootstrapRunner, /fromJSON\(inputs.controller_labels\)/);
  assert.match(bootstrapRunner, /inputs.runner_preference == 'github-hosted'/);
  assert.match(bootstrapRunner, /workflow_run.head_repository.full_name/);
});

test('hosted selector waits at most thirty minutes with virtual clock', async () => {
  const result = await run({ PHASE: 'select' });
  assert.equal(result.elapsed, 1800000);
  assert.equal(result.calls, 180);
  assert.equal(result.output.runner_kind, 'github-hosted');
  assert.match(result.output.reason, /deadline/);
});

test('busy runner becoming idle is selected without waiting for deadline', async () => {
  const result = await run({ PHASE: 'select' }, [
    { runners: [runner(true)], total_count: 1 }, { runners: [runner()], total_count: 1 }
  ]);
  assert.equal(result.output.runner_kind, 'self-hosted');
  assert.equal(result.elapsed, 10000);
});

test('zero wait performs bootstrap check but no subsequent polling', async () => {
  const bootstrap = await run({ WAIT_MINUTES: '0' });
  assert.equal(bootstrap.calls, 1);
  const result = await run({ PHASE: 'select', WAIT_MINUTES: '0', DEADLINE: '0' });
  assert.equal(result.calls, 0);
  assert.equal(result.output.runner_kind, 'github-hosted');
});

for (const overrides of [
  { RUNNER_PREFERENCE: 'github-hosted' }, { IS_FORK_PULL_REQUEST: 'true' },
  { RUNNER_CHECK_TOKEN: '' }, { PHASE: 'select', SCAN_STATUS: 'lookup-failed' }
]) {
  test(`safe immediate hosted path ${JSON.stringify(overrides)}`, async () => {
    const result = await run(overrides);
    assert.equal(result.output.runner_kind, 'github-hosted');
    assert.equal(result.calls, 0);
    assert.ok(result.output.reason);
  });
}

test('API denial uses explicit fallback without polling', async () => {
  const result = await run({ PHASE: 'select' }, [new Error('403')]);
  assert.equal(result.output.runner_kind, 'github-hosted');
  assert.match(result.output.reason, /verified/);
  assert.equal(result.calls, 1);
  assert.equal(result.elapsed, 0);
});

test('finds eligible runner on second page', async () => {
  const result = await run({}, [
    { runners: [], total_count: 101 }, { runners: [runner()], total_count: 101 }
  ]);
  assert.equal(result.output.runner_kind, 'self-hosted');
  assert.equal(result.calls, 2);
});

test('offline runner is never selected', async () => {
  const offline = { ...runner(), status: 'offline' };
  const result = await run({}, [{ runners: [offline], total_count: 1 }]);
  assert.equal(result.output.runner_kind, 'github-hosted');
});

test('elapsed bootstrap time reduces the remaining polling budget', async () => {
  const result = await run({ PHASE: 'select' }, undefined, 0, 20000);
  assert.equal(result.elapsed, 1800000);
  assert.equal(result.calls, 178);
});

test('slow API cannot extend the overall deadline', async () => {
  const result = await run({ PHASE: 'select', DEADLINE: '13000' }, undefined, 5000);
  assert.equal(result.elapsed, 13000);
  assert.equal(result.output.runner_kind, 'github-hosted');
});

test('malformed API response falls back without repeated polling', async () => {
  const result = await run({ PHASE: 'select' }, [{}]);
  assert.match(result.output.reason, /verified/);
  assert.equal(result.calls, 1);
});

test('network request timeout has a bounded hosted fallback', async () => {
  const result = await run({ PHASE: 'select' }, undefined, 15000);
  assert.equal(result.elapsed, 10000);
  assert.match(result.output.reason, /verified/);
  assert.equal(result.calls, 1);
});

for (const overrides of [
  { WAIT_MINUTES: '31' }, { WAIT_MINUTES: '-1' }, { WAIT_MINUTES: 'invalid' },
  { SELF_HOSTED_LABELS: '{}' }, { SELF_HOSTED_LABELS: '["macOS"]' },
  { RUNNER_PREFERENCE: 'invalid' }, { GITHUB_HOSTED_LABEL: 'self-hosted' }
]) {
  test(`rejects invalid inputs ${JSON.stringify(overrides)}`, async () => {
    await assert.rejects(run(overrides));
  });
}

test('both jobs execute the same reviewed script', () => {
  assert.equal(workflow.jobs.select.steps[0].with.script, script);
  assert.equal(workflow.jobs.bootstrap['timeout-minutes'], 2);
  assert.equal(workflow.jobs.select['timeout-minutes'], 35);
});

test('both jobs reject fork-origin workflow_run events as well as pull requests', () => {
  for (const job of Object.values(workflow.jobs)) {
    const trustGuard = job.steps[0].env.IS_FORK_PULL_REQUEST;
    assert.match(trustGuard, /pull_request.head.repo.full_name/);
    assert.match(trustGuard, /workflow_run.head_repository.full_name/);
  }
});