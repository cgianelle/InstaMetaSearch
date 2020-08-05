const {pageLimit, queryHash} = require('config');
const {
    fetchMediaFromInstagramPosts, 
    fetchDocumentObjectModel, 
    findWindowSharedDataJSScriptElement,
    getSharedDataString
} = require('./lib/insta'); 
const request = require('request-promise-native');
const url = require('url');


/*
https://stackoverflow.com/questions/54238696/what-is-query-hash-in-instagram
https://www.instagram.com/graphql/query/?query_hash=44efc15d3c13342d02df0b5a9fa3d33f&variables=%7B%22id%22%3A%2227448902919%22%2C%22first%22%3A12%2C%22after%22%3A%22QVFBaml0WVpSc2tfWVhSTDhmU3hwcExWRW1OTXRBSUZfZ2FrNTEtNWtwWEZSX3hkaC1Iekt2cERua1NTSlJmS2E2UUU5VWVVeVNKQ0Z0MUYwbUZ0d2FKNg%3D%3D%22%7D
*/

const instagramProfile = process.argv[2]
console.log(instagramProfile);
const profileUrl = url.parse(instagramProfile);
const profilePath = profileUrl.pathname;

fetchDocumentObjectModel(instagramProfile)
    .then(parseHTMLProfilePage)
    .then(iteratePaging)
    .catch(error => {
        console.error(error);    
    });

async function parseHTMLProfilePage($) {
    let htmlScriptElementList = findWindowSharedDataJSScriptElement($);

    if (htmlScriptElementList.length != 1) {
        throw new Error("Unable to find the scripts block with the sharedData");
    } 

    const {0: htmlScriptElement} = htmlScriptElementList;
    const sharedDataString = getSharedDataString($, htmlScriptElement);
    const sharedDataObject = JSON.parse(sharedDataString);
    
    const {
        entry_data: {
            ProfilePage: {
                0: {
                    graphql: {
                        user: {
                            id, 
                            edge_owner_to_timeline_media: {
                                page_info,
                                edges
                            }
                        }
                    }
                }
            }
        }
    } = sharedDataObject;

    //--put the shortcodes into a queue for processing
    const shortcodes = edges.map(getNodeShortCodes);
    return {shortcodes, id, page_info};
}

function getNodeShortCodes(node) {
    const {node: {shortcode}} = node;
    return shortcode;
}

async function iteratePaging(paging) {
    let {shortcodes, id, page_info} = paging;
    //--put the shortcodes into a queue for processing
    queueShortcodesForMediaRetrieval(shortcodes);

    const profilePage = new InstagramProfilePage(id, page_info);

    try {
        while (profilePage.hasNextPage) {
            shortcodes = (await profilePage.fetchNextPage()).processNextPage();
            queueShortcodesForMediaRetrieval(shortcodes);
        }
    } catch (error) {
        console.error(error);
    }

    return;
}

function queueShortcodesForMediaRetrieval(shortcodes) {
    
    const postURLs = shortcodes.map(convertShortcodeIntoInstagramPostURL);
    fetchMediaFromInstagramPosts(postURLs, profilePath);
    
    function convertShortcodeIntoInstagramPostURL(shortcode) {
        return `https://www.instagram.com/p/${shortcode}`;
    }

}

class InstagramProfilePage {
    constructor(id, page_info) {
        this.profileId = id;
        this.mapPageInfo(page_info);

        //--https://github.com/mineur/instagram-parser/blob/master/docs/setup.md#how-to-get-your-query-hash-old-query-id
        this.query_hash = queryHash;
    }

    mapPageInfo(page_info) {
        let {has_next_page, end_cursor} = page_info;
        this.has_next_page = has_next_page || false;
        this.end_cursor = end_cursor;
    }

    get hasNextPage() {
        return this.has_next_page;
    }

    async fetchNextPage() {
        //--Seems like 50 is the max; gave it 100, but graphql only returned 50
        const varString = JSON.stringify({'id':this.profileId,"first":pageLimit,"after":this.end_cursor});
        const variables = encodeURIComponent(varString);
        const PAGING_URL=`https://www.instagram.com/graphql/query/?query_hash=${this.query_hash}&variables=${variables}`;
        try {
            const jsonString = await request(PAGING_URL);
            this.pageData = JSON.parse(jsonString);
            return this;
        } catch (error) {
            throw error;
        }
    }

    processNextPage() {
        const {
            data:{
                user:{
                    edge_owner_to_timeline_media: {
                        page_info,
                        edges
                    }
                }
            }
        } = this.pageData;
    
        this.mapPageInfo(page_info);
        //--put the shortcodes into a queue for processing
        return edges.map(getNodeShortCodes);
    }
}