const { Cluster } = require('puppeteer-cluster');
const twofactor = require('node-2fa');
const fs = require('fs');
//skip loi memory leak
process.setMaxListeners(0);
const waitingtime = 2 * 60 * 60 * 1000;
var accountlists = fs.readFileSync('accountlists.txt').toString().split("\n");

let accountList = [];
let accountResult = [];
let accountError = [];
let target = 150;
for (let i = 0; i <= accountlists.length - 1; i++) {
    let acclist = accountlists[i].toString().split('|');
    console.log(acclist)
    if (acclist != '') {
        if (acclist[3] != null) {
            target = acclist[3];
        }
        accountList.push({ 'profile': acclist[0], 'email': acclist[1], 'password': 'Quocdai281193', 'awt': acclist[2].trim(), 'target': target });
    }
}

(async () => {
    const date = new Date();
    const today = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear();
    const path = `./${today} ordercharge`
    if (!fs.existsSync(path)) {
        await fs.mkdirSync(path);
    }
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 3,
        puppeteerOptions: { headless: false },
        timeout: waitingtime,
        monitor: true
    });

    cluster.task(async ({ page, data: account }) => {
        await signin(page, account.profile, account.email, account.password, account.awt, account.target, today);
    });

    for (let account of accountList) {
        try {
            cluster.queue(account);
        } catch (error) {
            console.log(error);
        }
    }

    cluster.on('taskerror', (err, data) => {
        accountResult.push();
        fs.appendFileSync('result.txt', data + ' error message: ' + err.message + '\n');
        console.log(`Error ${data}: ${err.message}`);
    });

    await cluster.idle();
    await cluster.close();

})();

async function signin(page, profile, email, password, awt, target, today) {
    let signin;
    await page.setViewport({ width: 1280, height: 1000 })
    await page.goto('https://amazon.com')
    console.log('vao trang amazon.com');
    await page.waitForSelector('#nav-link-accountList');
    //click sign in button
    await page.click('#nav-link-accountList');
    await page.waitForSelector('#ap_email');
    await page.type('#ap_email', email, { delay: 100 });
    await page.waitForSelector('#ap_password');
    await page.type('#ap_password', password, { delay: 100 });
    const rememberchk = await page.$('input[type=checkbox]');
    rememberchk.click();
    console.log('email: ' + email + ' wait click sign in.Waiting time: 2 hours')
    await page.waitForSelector('#auth-mfa-otpcode', { timeout: waitingtime });
    //2 step
    const codeauthen = twofactor.generateToken(awt);
    await page.type('#auth-mfa-otpcode', codeauthen['token'], { delay: 100 });
    const dontask = await page.$('input[type=checkbox]');
    dontask.click();
    signin = await page.$('input[type=submit]');
    signin.click();
    try {
        await page.waitForSelector('#auth-error-message-box > div', { timeout: 5000 })
        console.log('acc' + email + ' sign in error, exit')
        await accountError.push(email + ': login error')
        fs.appendFileSync('error.txt', email + ': login error\n');
        await page.screenshot({ path: `./${today} ordercharge/${profile}error.jpg` });
        await removeaccount(email);
        await page.close();
    } catch (error) {
        console.log('email: ' + email + ' loged in');
    }
    await monitor(page, '#ordersContainer > div.a-row.a-spacing-base > label > span', async a => {
        if (a == 1) {
            await page.screenshot({ path: `./${today} ordercharge/${profile}.jpg` });
            removeaccount(email);
            await page.close();
        }
    })
}

async function monitor(page, selector, callback, prevValue) {
    await page.goto('https://www.amazon.com/gp/your-account/order-history?ref_=ya_d_c_yo', { waitUntil: 'networkidle0' });
    let newVal;
    let flag = 0;
    try {
        newVal = await page.$eval(selector, e => e.innerHTML);
    } catch (error) {
        flag = 1;
        newVal = await page.$eval('#controlsContainer > div.a-row.a-spacing-base.top-controls > label > span', e => e.innerHTML);
    }
    const a = await parseInt(newVal.replace(/[a-z.]/g, ''))
    if (a !== prevValue) {
        callback(a);
    }
    console.log('3p sau se cap nhap lai')
    /* add some delay */
    await new Promise(_ => setTimeout(_, 180000))
    /* call recursively */
    if (flag == 0) {
        await monitor(page, selector, callback, newVal);
    } else {
        await monitor(page, newVal, callback, newVal);
    }

}

async function removeaccount(email) {
    fs.readFile('accountlists.txt', { encoding: 'utf-8' }, function (err, data) {
        if (err) throw error;

        let dataArray = data.split('\n'); // convert file data in an array
        const searchKeyword = email; // we are looking for a line, contains, key word 'user1' in the file
        let lastIndex = -1; // let say, we have not found the keyword

        for (let index = 0; index < dataArray.length; index++) {
            if (dataArray[index].includes(searchKeyword)) { // check if a line contains the 'user1' keyword
                lastIndex = index; // found a line includes a 'user1' keyword
                break;
            }
        }
        dataArray.splice(lastIndex, 1); // remove the keyword 'user1' from the data Array
        // UPDATE FILE WITH NEW DATA
        // IN CASE YOU WANT TO UPDATE THE CONTENT IN YOUR FILE
        // THIS WILL REMOVE THE LINE CONTAINS 'user1' IN YOUR shuffle.txt FILE
        const updatedData = dataArray.join('\n');
        fs.writeFile('accountlists.txt', updatedData, (err) => {
            if (err) throw err;
            console.log('Successfully! Remove ' + email);
        });
    });
}


