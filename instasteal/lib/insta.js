var request = require('request-promise-native');
const {JSDOM} = require("jsdom");
var fs = require('fs');
var url = require('url');
const {default: PQueue} = require('p-queue');
var https = require('https');

const fetchImageQueue = new PQueue({concurrency: 5});
const downloadImageQueue = new PQueue({concurrency: 5});
/******************************************************88
 * TODO:
 * 1) do we need to support HTTP AND HTTPS or just HTTPS
 * 3) Refactoring
 *********************************************************/

const DOWNLOAD_DIR = '/home/cgianelle/Downloads/';
const WINDOW_SHAREDDATA = "window._sharedData =";
const JS_WHERE_INSTAGRAM_KEEPS_IMAGE_URLS = "window._sharedData = {";

function fetchMediaFromInstagramPosts(arrayOfInstagramPostURLs) {
    arrayOfInstagramPostURLs.forEach(url => fetchImageQueue.add(() => fetchMediaFromInstagramPost(url)));
}

async function fetchMediaFromInstagramPost(url) {
    console.log(`Fetching media content from Instagram post, ${url}`);
    const $ = await fetchDocumentObjectModel(url);

    let htmlScriptElementList = findSpecificJSScriptElement($, JS_WHERE_INSTAGRAM_KEEPS_IMAGE_URLS);

    if (htmlScriptElementList.length != 1) {
        throw new Error("Unable to find the scripts block with the sharedData");
    } 

    const {0: htmlScriptElement} = htmlScriptElementList;

    const sharedDataString = getSharedDataString($, htmlScriptElement);
    
    let urls = extractMediaURLs(sharedDataString);
    urls.forEach(url => downloadImageQueue.add(() => downloadFile(url)));
}

async function fetchDocumentObjectModel(url) {
    const htmlString = await request(url);
    const dom = new JSDOM(htmlString);
    return (require('jquery'))(dom.window);
}

function findSpecificJSScriptElement($, searchString) {
    let jsScriptElementsList = $.find("script[type='text/javascript']");
    jsScriptElementsList = jsScriptElementsList.filter(script => {
        return ($(script).text().includes(searchString));
    });
    return jsScriptElementsList;
}

function getSharedDataString($, htmlScriptElement) {
    return $(htmlScriptElement).text().slice(WINDOW_SHAREDDATA.length, $(htmlScriptElement).text().length - 1);
}

function extractMediaURLs(sharedDataString) {
    const sharedDataJSONObj = JSON.parse(sharedDataString);
    var urls = [];
    var postPage = sharedDataJSONObj["entry_data"]["PostPage"];
    postPage.forEach(element => {
        var { graphql: { shortcode_media: { display_url, video_url, edge_sidecar_to_children: { edges } = {} } } } = element;
        if (edges) {
            fetchMultiMediaURLs(edges, urls);
        }
        else {
            // console.log(element); //TODO maybe a debug option?
            fetchSingleMediaURL(video_url, urls, display_url);
        }
    });
    return urls;
}

function fetchSingleMediaURL(video_url, urls, display_url) {
    console.log("Does not appear to be a multi-image post, trying video/display url...");
    video_url ? urls.push(video_url) : urls.push(display_url);
}

function fetchMultiMediaURLs(edges, urls) {
    edges.forEach(edge => {
        var { node: { display_resources: resources = {} } } = edge;
        largest = resources[resources.length - 1]; //--pick the last one, its the largest image
        urls.push(largest.src);
    });
}

// Function for downloading file using HTTP.get
function downloadFile(file_url) {
    const requestUrl = url.parse(file_url, true);

    var fileName = requestUrl.pathname.split('/').pop();
    var fileStream = fs.createWriteStream(DOWNLOAD_DIR + fileName);

    // console.log(requestUrl, file_name)
    https.get(requestUrl, function(res) {
        res.on('data', function(data) {
            fileStream.write(data);
        }).on('end', function() {
            fileStream.end();
            console.log(fileName + ' downloaded to ' + DOWNLOAD_DIR);
        });
    });
};

exports.fetchMediaFromInstagramPosts = fetchMediaFromInstagramPosts;