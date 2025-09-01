const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const fs = require('fs');
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
// This function has been corrected to use 'helm package'
function package() {
  const args = [
    'package', // <-- CHANGED from 'pack' to 'package' to support --version flag
    core.getInput('chart'),
    '--dependency-update',
    '--destination',
    RELEASE_DIR,
    ...core.getInput('packageExtraArgs').split(/\s+/),
  ];

  const version = core.getInput('version');
  if (version) {
    args.push('--version', version);
  }

  return args;
}

// Returns argument required to push the chart release to S3 repository.
function push() {
  const releaseFile = path.join(RELEASE_DIR, fs.readdirSync(RELEASE_DIR)[0]);
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

// Returns argument required to install helm-s3 and helm-pack plugins.
// This function has been corrected to remove the helm-pack plugin installation.
async function installPlugins() {
  try {
    let helmS3Version = core.getInput('helmS3Version'); // Optional input
    if (!helmS3Version) {
      helmS3Version = await getLatestHelmS3Version(); // Fetch latest if not provided
    }

    // Install helm-s3 with --version flag
    await exec.exec(HELM, ['plugin', 'install', 'https://github.com/hypnoglow/helm-s3.git', '--version', helmS3Version]);

    // The helm-pack plugin is no longer needed, so this line has been removed.
    // await exec.exec(HELM, ['plugin', 'install', 'https://github.com/thynquest/helm-pack.git']);
  } catch (err) {
    core.error(`Failed to install plugins: ${err.message}`);
    throw err;
  }
}

async function main() {
  try {
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