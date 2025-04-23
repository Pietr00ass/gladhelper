;(function(){
  const origFetch = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    if (typeof url === "string" && url.includes("/check-licence")) {
      const apiUrl = `${process.env.RAILWAY_URL || 'https://your-app.up.railway.app'}/check-licence?userId=` + encodeURIComponent(window.localStorage.getItem('userId') || 'default');
      const resp = await origFetch(apiUrl);
      const data = await resp.json();
      console.log(`🤖 [Licence] typ=${data.licence}, dni=${data.days}`);
      return new Response(JSON.stringify(data));
    }
    return origFetch(url, init);
  };
})();