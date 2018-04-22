const {Builder, By, Key, until} = require('selenium-webdriver');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');
const readline = require('readline');
const Writable = require('stream').Writable;

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
    ['u', 'hsbc_username=ARG', 'The username'],
    ['a', 'hsbc_account=ARG', 'The bank account number'],
    ['', 'month[=ARG]', 'The month of the statement (Jan, Feb, Mar..); defaults to current month'],
    ['', 'dir[=ARG]', 'Directory to shove the statement in. Absolute paths only'],
]).bindHelp().parseSystem();

const save_dir = opt.options.dir || path.join(process.env.HOME, '/bank2');

let password, secret;

function build_driver() {
  return new Builder().
  withCapabilities({
    'browserName': 'firefox', // the only reason for this is chrome saves files to ~/Downloads by default and we need to rely on that to grab the statement.
  }).
  build();
}

function login(driver) {
  return driver.get('https://www.hsbc.co.uk/1/2/welcome-gsp?initialAccess=true&IDV_URL=hsbc.MyHSBC_pib')
  .then(() => driver.sleep(3000))
  .then(() => driver.findElement(By.id('Username1')))

  .then((el) => el.sendKeys(opt.options.hsbc_username))

  .then(() => driver.findElement(By.css('.submit_input')))
  .then((el) => el.click());
}

function selectLogOnWithoutSecureKey(driver) {
  return driver.findElement(By.css('.listStyle02 li[aria-checked="false"]'))
    .then((el) => el.click());
}

function answerMemorableQuestion(driver) {
  return driver.findElement(By.id('memorableAnswer'))
    .then((el) => el.sendKeys(secret));
}

function fillMemorableInfoCharacter(driver, idx) {
  return new Promise(function (resolve, reject) {
    driver.wait(until.elementLocated(By.css('.FontRed span:nth-child(' + idx + ')')), 10000)
    .then((el) =>
        driver.executeScript(function() {
          return arguments[0].innerHTML;
        }, el))

    .then((html) => {
      let secret_characters = password.split("");
      let wanted_char;

      if (html.match(/(\d)\S\S/)) {
        wanted_char = html.match(/(\d)\S\S/)[1];
      } else if (html.match(/second to last/)) {
        wanted_char = secret_characters.length - 1;
      } else if (html.match(/last/)) {
        wanted_char = secret_characters.length;
      }

      let answer = secret_characters[wanted_char - 1];

      driver.findElements(By.css('.smallestInput.active'))
        .then((els) => { els[idx - 1].sendKeys(answer) } )
        .then(() => resolve())
    });
  });
}

function openStatementOptions(driver) {
  return driver.findElement(By.id('dapViewMoreDownload'))
  .then((el) => el.click());
}

function downloadStatement(driver) {
  // for some completely stupid reason I can't select the download button with
  // CSS even though the same selector works on the browser.  So I 'tab' on the
  // input, then grab the active element (which is now the download button) and
  // click it.
  return driver.findElement(By.css('input[name="downloadAsCSV"]'))
  .then((el) => { el.click(); el.sendKeys(Key.TAB); })
  .then(() => driver.switchTo().activeElement())
  .then((el) => { driver.actions().keyDown(Key.CONTROL).click(el).keyUp(Key.CONTROL).perform() });
}


function logOff(driver) {
  return driver.findElement(By.css('a[title="Log off"]'))
    .then((el) => el.click());
}

function makeSaveDir() {
  return new Promise((resolve, reject) => mkdirp(save_dir, (err) => err ? reject(err) : resolve()));
}

function moveDownloadedCSV() {
  let month = opt.options.month || moment().format('MMM');

  let new_filename = moment(new Date(month + '1 ' + moment().format('Y') + ' 00:00 UTC')).format('YMM') + 'h.csv';

  return new Promise((resolve, reject) => {
    let found = false;

    glob(`${downloads_dir}/TransHist.csv`, { }, function(er, files) {
      if (er) {
        reject(er);
      }
      let file = files[0];
      if (!file) {
        return reject("Could not find a file matching TransHist.csv");
      }
      fs.rename( file, path.join(save_dir, new_filename), (err) => err ? reject(err) : resolve(path.join(save_dir, new_filename))  );
    });
  });
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

    .then(() => selectLogOnWithoutSecureKey(driver))


    .then(() => answerMemorableQuestion(driver))

    .then(() => fillMemorableInfoCharacter(driver, 1))
    .then(() => fillMemorableInfoCharacter(driver, 2))
    .then(() => fillMemorableInfoCharacter(driver, 3))

    .then(() => driver.findElement(By.css('.submit_input')))

    .then((el) => el.click())

    .then(() => driver.sleep(5000))

    .then(() => openStatementOptions(driver))
    .then(() => driver.sleep(500))
    .then(() => downloadStatement(driver))
    .then(() => driver.sleep(5000))
/*
    .then(() => logOff(driver))

    .then(() => moveDownloadedCSV())
    .then((csvname) => console.log("DOWNLOADED FILE " + csvname))
    .then(() => driver.quit())
    .then(() => console.log("DONE"));*/
  });

  /* Essentially we're muting after we've asked the question but before we've got
   * the answer. That way the answer is invisible. */
  mutableStdout.muted = true;
});

mutableStdout.muted = true;

// Again muting right after we've asked the question.
// Thanks to all the async stuff going on, this is the order the above code is executed:
// 1: line 147, the question is asked.
// 2: line 195, mutableStdout.muted is turned on
// 3: User inputs the password, which is invisible.
// 4: lines 148-150 are executed, which stores the password in 'password' and un-mutes the output so we can ask the next question.
// 5. line 152, again question is asked
// 6. line 192, muting the output again.
// 7. lines 153-187 after the user has answered.
