const {fetchMediaFromInstagramPosts} = require('./lib/insta'); 
const instagramHttpUrls = process.argv.slice(2);
console.log(instagramHttpUrls);

fetchMediaFromInstagramPosts(instagramHttpUrls);