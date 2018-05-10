const {Builder, By, Key, until} = require('selenium-webdriver');
const moment = require('moment');
const path = require('path');
const mkdirp = require('mkdirp');
const readline = require('readline');
const Writable = require('stream').Writable;

const { move_file } = require('./lib/util');

const downloads_dir = path.join(process.env.HOME, '/Downloads');

/* I don't really like the way this works but I got it from
 * https://stackoverflow.com/a/33500118 . It hides passwords in terminals. */

const mutableStdout = new Writable({
  write: function(chunk, encoding, callback) {
    if (!this.muted)
      process.stdout.write(chunk, encoding);
    callback();
  }
});

mutableStdout.muted = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: mutableStdout,
  terminal: true,
});

let opt = require('node-getopt').create([
    ['u', 'lloyds_username=ARG', 'The Lloyds bank username'],
    ['a', 'lloyds_account=ARG', 'The Lloyds bank account number'],
    ['', 'month[=ARG]', 'The month of the statement (Jan, Feb, Mar..); defaults to current month'],
    ['', 'dir[=ARG]', 'Directory to shove the statement in. Absolute paths only'],
]).bindHelp().parseSystem();

const save_dir = opt.options.dir || path.join(process.env.HOME, '/bank2');

let password, secret;

function build_driver() {
  return new Builder().
  withCapabilities({
    'browserName': 'chrome', // the only reason for this is chrome saves files to ~/Downloads by default and we need to rely on that to grab the statement.
  }).
  build();
}

function login(driver) {
  return driver.get('https://online.lloydsbank.co.uk/personal/logon/login.jsp')
  .then(() => driver.findElement(By.id('frmLogin:strCustomerLogin_userID')))
  .then((el) => el.sendKeys(opt.options.lloyds_username))

  .then(() => driver.findElement(By.id('frmLogin:strCustomerLogin_pwd')))
  .then((el) => el.sendKeys(password))

  .then(() => driver.findElement(By.id('frmLogin:btnLogin2')))
  .then((el) => el.click());
}

function fillMemorableInfoCharacter(driver, idx) {
  return new Promise(function (resolve, reject) {
    driver.wait(until.elementLocated(By.css('label[for="frmentermemorableinformation1:strEnterMemorableInformation_memInfo' + idx + '"]')), 10000)
    .then((el) =>
        driver.executeScript(function() {
          return arguments[0].innerHTML;
        }, el))

    .then((html) => {
      let wanted_char = html.match(/Character (\d) :/)[1];
      let secret_characters = secret.split("");
      let answer = secret_characters[wanted_char - 1];

      driver.findElement(By.id('frmentermemorableinformation1:strEnterMemorableInformation_memInfo' + idx))
      .then((el) => el.sendKeys(answer))
      .then(() => resolve());
    })
  });
}

function viewStatement(driver) {
  // only the first account in the list at the time being
  return driver.findElement(By.css('a[title="View statement"]'))
  .then((el) => el.click());
}


function selectCurrentMonth(driver) {
  let month = opt.options.month || moment().format('MMM');
  return driver.findElement(By.css(`button[aria-label="${month} transactions"]`))
  .then((el) => el.click());
}

function openStatementOptions(driver) {
  return driver.findElement(By.css('button[aria-label="Statement options"]'))
  .then((el) => el.sendKeys(Key.DOWN, Key.DOWN, Key.DOWN, Key.DOWN, Key.ENTER))
}

function downloadStatement(driver) {
  return driver.findElement(By.css('select[name="exportFormat"]'))
  .then((el) => el.sendKeys('I')) // Internet banking (CSV)
  .then(() => driver.findElement(By.id('exportStatementsButton')))
  .then((el) => el.click());
}

function closeModal(driver) {
  return driver.findElement(By.id('modal-close')).then((el) => el.click());
}

function logOff(driver) {
  return driver.findElement(By.css('a[title="Log off"]'))
    .then((el) => el.click());
}

function makeSaveDir() {
  return new Promise((resolve, reject) => mkdirp(save_dir, (err) => err ? reject(err) : resolve()));
}

function moveDownloadedCSV() {
  let file_pattern = opt.options.lloyds_account + "_" + moment().format('YMMDD');
  file_pattern = `${downloads_dir}/${file_pattern}*.csv`;

  let month = opt.options.month || moment().format('MMM');

  let new_filename = moment(new Date(month + '1 ' + moment().format('Y') + ' 00:00 UTC')).format('YMM') + '.csv';
  new_Filename = path.join(save_dir, new_filename);

  return move_file(file_pattern, new_filename);
}


rl.question("What is your password?\n", (pass) => {
  password = pass;
  // Un-mute to ask the next question.
  mutableStdout.muted = false;

  rl.question("\nWhat is your memorable info?\n", (mem) => {
    secret = mem;
    rl.close();

    let driver = build_driver();

    makeSaveDir()

    .then(() => login(driver))

    .then(() => driver.wait(until.titleIs('Lloyds Bank - Enter Memorable Information'), 10000))
    .then(() => fillMemorableInfoCharacter(driver, 1))
    .then(() => fillMemorableInfoCharacter(driver, 2))
    .then(() => fillMemorableInfoCharacter(driver, 3))
    .then(() => driver.findElement(By.id('frmentermemorableinformation1:btnContinue')))

    .then((el) => el.click())
    .then(() => viewStatement(driver))

      // there's ajax magic so give it a few seconds
    .then(() => driver.sleep(1000))
    .then(() => selectCurrentMonth(driver))
    .then(() => driver.sleep(1000))
    .then(() => openStatementOptions(driver))
    .then(() => driver.sleep(1000))
    .then(() => downloadStatement(driver))
    .then(() => driver.sleep(2000))

    .then(() => closeModal(driver))
    .then(() => logOff(driver))

    .then(() => moveDownloadedCSV())
    .then((csvname) => console.log("DOWNLOADED FILE " + csvname))
    .then(() => driver.quit())
    .then(() => console.log("DONE"));
  });

  /* Essentially we're muting after we've asked the question but before we've got
   * the answer. That way the answer is invisible. */
  mutableStdout.muted = true;
});

mutableStdout.muted = true;

// Again muting right after we've asked the question.
// Thanks to all the async stuff going on, this is the order the above code is executed:
// 1: line 143, the question is asked.
// 2: line 190, mutableStdout.muted is turned on
// 3: User inputs the password, which is invisible.
// 4: lines 144-146 are executed, which stores the password in 'password' and un-mutes the output so we can ask the next question.
// 5. line 148, again question is asked
// 6. line 187, muting the output again.
// 7. lines 149-182 after the user has answered.
