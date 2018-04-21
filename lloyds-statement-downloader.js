const {Builder, By, Key, until} = require('selenium-webdriver');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const glob = require('glob');

const downloads_dir = path.join(process.env.HOME, '/Downloads');
const save_dir = path.join(process.env.HOME, '/bank2');

let opt = require('node-getopt').create([
    ['u', 'lloyds_username=ARG', 'The Lloyds bank username'],
    ['p', 'lloyds_password=ARG', 'The Lloyds bank password'],
    ['s', 'lloyds_secret=ARG', 'The Lloyds bank secret/memorable information word'],
    ['a', 'lloyds_account=ARG', 'The Lloyds bank account number']
]).bindHelp().parseSystem();

console.log(opt.options);

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
    .then((el) => el.sendKeys(opt.options.lloyds_password))

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
            let secret_characters = opt.options.lloyds_secret.split("");
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
  let month = moment().format('MMM');
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
  let file_match = opt.options.lloyds_account + "_" + moment().format('YMMDD');
  let new_filename = moment().format('YMM') + '.csv';

  return new Promise((resolve, reject) => {
    let found = false;

    glob(`${downloads_dir}/${file_match}*.csv`, { }, function(er, files) {
      if (er) {
        reject(er);
      }
      let file = files[0];
      if (!file) {
        return reject("Could not find a file matching " + file_match);
      }
      fs.rename( file, path.join(save_dir, new_filename), (err) => err ? reject(err) : resolve(path.join(save_dir, new_filename))  );
    });

  });
}

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
.then(() => driver.sleep(5000))
.then(() => selectCurrentMonth(driver))
.then(() => driver.sleep(5000))
.then(() => openStatementOptions(driver))
.then(() => driver.sleep(1000))
.then(() => downloadStatement(driver))
.then(() => driver.sleep(5000))

.then(() => closeModal(driver))
.then(() => logOff(driver))

.then(() => moveDownloadedCSV())
.then((csvname) => console.log("DOWNLOADED FILE " + csvname))
.then(() => driver.quit())
.then(() => console.log("DONE"));

