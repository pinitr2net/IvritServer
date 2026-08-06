(function () {
  try {
    alert(
      '✅ Ecommo test script loaded!\n' +
      'Page: ' + location.hostname + location.pathname + '\n' +
      'Time: ' + new Date().toLocaleTimeString()
    );
  } catch (e) {}
  try {
    console.log('[ecommo-test] executed on', location.href, 'at', new Date().toISOString());
  } catch (e) {}
})();