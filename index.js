const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { getLatestHelmS3Version } = require('./utils');

const HELM = 'helm';
const REPO_ALIAS = 'repo';
const RELEASE_DIR = '.release/';

// Returns argument required to register the S3 repository.
function repo() {
  const repo = core.getInput('repo', { required: true });
  return ['repo', 'add', REPO_ALIAS, repo];
}

// Returns argument required to generate the chart package.
// This function has been corrected to handle empty packageExtraArgs.
function package() {
  const args = [
    'package',
    core.getInput('chart'),
    '--dependency-update',
    '--destination',
    RELEASE_DIR,
  ];

  // This is the definitive fix for the empty string argument
  const extraArgs = core.getInput('packageExtraArgs');
  if (extraArgs) {
    args.push(...extraArgs.split(/\s+/));
  }

  const version = core.getInput('version');
  if (version) {
    args.push('--version', version);
  }

  // Diagnostic line you added
  console.log('ARGS------', args);

  return args;
}

// Returns argument required to push the chart release to S3 repository.
function push() {
  const chartPath = core.getInput('chart');
  const chartYaml = yaml.load(fs.readFileSync(path.join(chartPath, 'Chart.yaml'), 'utf8'));

  const chartName = chartYaml.name;
  const version = core.getInput('version');

  const releaseFile = path.resolve(RELEASE_DIR, `${chartName}-${version}.tgz`);

  const args = ['s3', 'push', releaseFile, REPO_ALIAS];

  const forceRelease = core.getInput('forceRelease', { required: true }) === 'true';
  if (forceRelease) {
    args.push('--force');
  } else {
    args.push('--ignore-if-exists');
  }

  const relativeUrls = core.getInput('relativeUrls', { required: true }) === 'true';
  if (relativeUrls) {
    args.push('--relative');
  }

  return args;
}

async function installPlugins() {
  try {
    let helmS3Version = core.getInput('helmS3Version');
    if (!helmS3Version) {
      helmS3Version = await getLatestHelmS3Version();
    }
    await exec.exec(HELM, ['plugin', 'install', 'https://github.com/hypnoglow/helm-s3.git', '--version', helmS3Version]);
  } catch (err) {
    core.error(`Failed to install plugins: ${err.message}`);
    throw err;
  }
}

async function main() {
  try {
    console.log('--- The updated script is running ---');
    if (!fs.existsSync(RELEASE_DIR)) {
      fs.mkdirSync(RELEASE_DIR, { recursive: true });
    }
    await installPlugins();
    await exec.exec(HELM, repo());
    await exec.exec(HELM, package());
    await exec.exec(HELM, push());
  } catch (err) {
    core.error(err);
    core.setFailed(err.message);
  }
}

main();