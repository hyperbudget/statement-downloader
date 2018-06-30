import { LloydsStatementDownloader } from './lib/LloydsStatementDownloader';
import * as path from 'path';

const downloads_dir = path.join(process.env.HOME, '/Downloads');

let opt = require('node-getopt').create([
  ['u', 'lloyds_username=ARG', 'The Lloyds bank username'],
  ['a', 'lloyds_account=ARG', 'The Lloyds bank account number'],
  ['', 'month[=ARG]', 'The month of the statement (Jan, Feb, Mar..); defaults to current month'],
  ['', 'dir[=ARG]', 'Directory to shove the statement in. Absolute paths only'],
]).bindHelp().parseSystem();

const save_dir = opt.options.dir || path.join(process.env.HOME, '/bank2');

(async () => {
  await new LloydsStatementDownloader({
    save_dir: save_dir,
    username: process.env.USERNAME || opt.options.lloyds_username,
    month: opt.options.month,
    downloads_dir: opt.options.dir || downloads_dir,
    account: process.env.ACCOUNT || opt.options.lloyds_account,
    password: process.env.PASSWORD,
    memorable_info: process.env.MEMORABLE_INFO,
  }).doDownloadStatement();
})();
