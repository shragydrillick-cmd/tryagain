// The older tests run the app without signing in (accounts have their own test: accounts.test.js).
// require('./noauth')(chromium) right after loading Playwright: every page then opens with accounts off.
module.exports = chromium => {
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const b = await launch(...args);
    const newContext = b.newContext.bind(b);
    b.newContext = async (...o) => {
      const c = await newContext(...o);
      await c.addInitScript(() => { try { localStorage.setItem('pick-and-sort-test-noauth', '1'); } catch (e) {} });
      return c;
    };
    b.newPage = async (...o) => (await b.newContext(...o)).newPage();
    return b;
  };
};
