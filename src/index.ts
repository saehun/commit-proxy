#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as execa from "execa";
import simpleGit from 'simple-git';

// initialize global variable
const proxyRepo = process.env.PROXY_REPO;
if (!proxyRepo) {
  throw new Error('proxy local repository is undefiend');
}

const git = simpleGit({
  baseDir: proxyRepo,
  binary: 'git',
});

const postCommitScript = `#!/bin/sh

# execute command with last commit log
git log -1 | commit-proxy proxy

# Add other post-commit hooks
`;

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

/**
 *
 */
const gitRoot = (cur = process.cwd()): string => {
  if (cur === '/') throw new Error(`Can't find git root`);

  const dir = fs.readdirSync(cur);
  if (dir.includes('.git')) {
    return cur;
  } else {
    return gitRoot(path.join(cur, '..'));
  }
};

/**
 * Copy commit
 */
const copyCommit = (projectName: string, commit: string): void => {
  const { commitMessage, file } = appendFile(projectName, commit);

  git.add(file);
  git.commit(commitMessage);
};

/**
 *
 */
const appendFile = (
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

const push = (): void => {
  git.push('origin', 'master');
};

const register = (): void => {
  const postCommitPath = path.join(gitRoot(), '.git', 'hooks', 'post-commit');
  if (fs.existsSync(postCommitPath)) {
    console.error('./.git/hooks/post-commit is alreay exist');
    process.exit(1);
  } else {
    fs.writeFileSync(postCommitPath, postCommitScript);
    execa('chmod', ['+x', postCommitPath]);
    console.log(postCommitPath, 'registered');
  }
};

const help = (): void => {
  console.log(`
commit-proxy <command>

command:
   - register: Register current git
   - push: Push proxy repo to origin
   - proxy: proxy commit in current repository
`);
};

// main
(async (): Promise<void> => {
  const cmd = process.argv[2]?.trim();
  if (cmd === 'push') {
    push();
  } else if (cmd === 'register') {
    register();
  } else if (cmd === 'proxy') {
    const commit = await getString();
    const projectName = gitRoot().split('/').slice(-1)[0];
    copyCommit(projectName, commit);
  } else {
    help();
  }
})();
