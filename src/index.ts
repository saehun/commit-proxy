import * as fs from 'fs';
import * as path from 'path';
import * as execa from 'execa';
import * as git from 'isomorphic-git';
import { homedir } from 'os';

// initialize global variable
const proxyRepo = process.env.PROXY_REPO;
const gituser = ((): { name: string; email: string } => {
  const configFile = fs.readFileSync(path.join(homedir(), '.gitconfig'), 'utf-8');
  const parseName = /name = (.+)\n/.exec(configFile);
  const parseEmail = /email = (.+)\n/.exec(configFile);
  if (!parseName || !parseEmail)
    throw new Error("can't find git global config. check ~/.gitconfig'");

  return {
    name: parseName[1],
    email: parseEmail[1],
  };
})();
if (!proxyRepo) {
  throw new Error('proxy local repository is undefiend');
}

const shebang = '#!/bin/sh\n';
const postCommitScript = 'git log -1 | commit-proxy proxy';

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
const copyCommit = async (projectName: string, commit: string): Promise<void> => {
  const { commitMessage } = appendFile(projectName, commit);

  await git.add({
    filepath: projectName,
    dir: proxyRepo,
    fs,
  });

  await git.commit({
    message: commitMessage,
    dir: proxyRepo,
    author: {
      name: gituser.name,
      email: gituser.email,
    },
    committer: {
      name: gituser.name,
      email: gituser.email,
    },
    fs,
  });
};

/**
 *
 */
const appendFile = (projectName: string, commit: string): { commitMessage: string } => {
  const file = path.join(proxyRepo, projectName);

  // if file doesn't exist, create
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '');
  }

  appendFileWithStream(file, commit);

  // return commit message
  return {
    commitMessage: commit.split('\n').slice(3).join('\n').trim(),
  };
};

/**
 * Don't use fs.appendFile, instead use this
 * https://stackoverflow.com/questions/3459476/how-to-append-to-a-file-in-node
 */
const appendFileWithStream = (filePath: string, data: string): void => {
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  stream.write(data);
  stream.write('\n');
  stream.end();
};

const push = async (): Promise<void> => {
  process.chdir(proxyRepo);
  await execa('git', ['push', 'origin', 'master']);
};

const register = (): void => {
  const postCommitPath = path.join(gitRoot(), '.git', 'hooks', 'post-commit');
  if (fs.existsSync(postCommitPath)) {
    appendFileWithStream(postCommitPath, postCommitScript);
  } else {
    fs.writeFileSync(postCommitPath, shebang + postCommitScript);
    execa('chmod', ['+x', postCommitPath]);
  }
  console.log(postCommitPath, 'registered');
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
    await push();
  } else if (cmd === 'register') {
    register();
  } else if (cmd === 'proxy') {
    const commit = await getString();
    const projectName = gitRoot().split('/').slice(-1)[0];
    await copyCommit(projectName, commit);
  } else {
    help();
  }
})();
