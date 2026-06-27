const { spawnSync } = require('child_process');

const env = {
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://nebirro:nebirro@localhost:5432/nebirro?schema=public',
  API_KEY_PEPPER: process.env.API_KEY_PEPPER ?? 'integration-test-pepper',
};

function run(command, args) {
  const options = {
    env,
    stdio: 'inherit',
  };
  const result =
    process.platform === 'win32'
      ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
      : spawnSync(command, args, { ...options, shell: false });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

run(npm, ['exec', '--', 'prisma', 'db', 'push']);
run(npm, ['exec', '--', 'jest', '--config', 'jest.integration.config.ts', '--runInBand']);
