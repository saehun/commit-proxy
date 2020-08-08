#!/usr/bin/env node
/**
 * .git/hooks/post-commit
#!/bin/sh

# execute command with last commit log
git log -1 | commit-proxy

# Add other post-commit hooks
 */
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

const getString = (): Promise<string> => {
  return new Promise(resolve => {
    let data = '';

    process.stdin.on('data', function (chunk) {
      data += chunk;
    });

    process.stdin.on('end', function () {
      resolve(data);
    });
  });
};

const gitRoot = (cur = process.cwd()): string => {
  if (cur === '/') throw new Error(`Can't find git root`);

  const dir = fs.readdirSync(cur);
  if (dir.includes('.git')) {
    return cur.split('/').slice(-1)[0];
  } else {
    return gitRoot(path.join(cur, '..'));
  }
};

const copyCommit = (projectName: string, commit: string): void => {
  const proxyRepo = process.env.PROXY_REPO;
  if (!proxyRepo) {
    throw new Error('proxy local repository is undefiend');
  }

  const git = simpleGit({
    baseDir: proxyRepo,
    binary: 'git',
  });

  const { commitMessage, file } = appendFile(proxyRepo, projectName, commit);

  git.add(file);
  git.commit(commitMessage);
};

const appendFile = (
  proxyRepo: string,
  projectName: string,
  commit: string
): { commitMessage: string; file: string } => {
  const file = path.join(proxyRepo, projectName);

  // if file doesn't exist, create
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, '');
  }

  fs.appendFileSync(file, commit + '\n');

  // return commit message
  return {
    commitMessage: commit.split('\n').slice(3).join('\n').trim(),
    file,
  };
};

// main
(async (): Promise<void> => {
  const commit = await getString();
  const projectName = gitRoot();
  copyCommit(projectName, commit);
})();
