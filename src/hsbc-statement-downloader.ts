import { HSBCStatementDownloader } from './lib/HSBCStatementDownloader';
import * as path from 'path';

const downloads_dir = path.join(process.env.HOME, '/Downloads');

let opt = require('node-getopt').create([
    ['u', 'hsbc_username=ARG', 'The username'],
    ['a', 'hsbc_account=ARG', 'The bank account number'],
    ['', 'month[=ARG]', 'The month of the statement (Jan, Feb, Mar..); defaults to current month'],
    ['', 'dir[=ARG]', 'Directory to shove the statement in. Absolute paths only'],
]).bindHelp().parseSystem();

const save_dir = opt.options.dir || path.join(process.env.HOME, '/bank2');

new HSBCStatementDownloader({
  save_dir: save_dir,
  username: process.env.USERNAME || opt.options.hsbc_username,
  month: opt.options.month,
  downloads_dir: downloads_dir,
  account: process.env.ACCOUNT || opt.options.hsbc_account,
  password: process.env.PASSWORD,
  memorable_info: process.env.MEMORABLE_INFO,
}).doDownloadStatement();
