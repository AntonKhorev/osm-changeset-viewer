const UserItemCommentStoreMap = {
    changesets: 'changesetComments',
    notes: 'noteComments'
};
class ScanBoundary {
    constructor(scan) {
        this.upperItemIds = new Set(scan.upperItemIds);
        this.lowerItemIds = new Set(scan.lowerItemIds);
        this.upperItemTimestamp = scan.upperItemDate.getTime();
        this.lowerItemTimestamp = scan.lowerItemDate.getTime();
        if (this.lowerItemTimestamp > this.upperItemTimestamp) {
            throw new RangeError(`invalid scan range`);
        }
    }
    get upperItemDate() {
        return new Date(this.upperItemTimestamp);
    }
    get lowerItemDate() {
        return new Date(this.lowerItemTimestamp);
    }
    getItemKeyRange(uid, streamBoundary) {
        const lowerItemDate = this.lowerItemDate;
        const upperItemDate = streamBoundary.getOwnOrLowerDate(this.upperItemDate);
        if (lowerItemDate.getTime() > upperItemDate.getTime())
            return null;
        return IDBKeyRange.bound([uid, lowerItemDate], [uid, upperItemDate, +Infinity]);
    }
    isItemInside(item) {
        const itemTimestamp = item.createdAt.getTime();
        if (itemTimestamp < this.lowerItemTimestamp ||
            itemTimestamp > this.upperItemTimestamp) {
            return false;
        }
        if (itemTimestamp == this.upperItemTimestamp &&
            !this.upperItemIds.has(item.id)) {
            return false;
        }
        if (itemTimestamp == this.lowerItemTimestamp &&
            !this.lowerItemIds.has(item.id)) {
            return false;
        }
        return true;
    }
}
class ChangesetViewerDBReader {
    constructor(idb) {
        this.idb = idb;
        this.closed = false;
        idb.onversionchange = () => {
            idb.close();
            this.closed = true;
        };
    }
    getUserInfoById(uid) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction(['users', 'userScans'], 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getUserById(): ${tx.error}`));
            const request = tx.objectStore('users').get(uid);
            request.onsuccess = () => {
                this.getPromisedUserWithScans(resolve, tx, request.result);
            };
        });
    }
    getUserInfoByName(username) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction(['users', 'userScans'], 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getUserById(): ${tx.error}`));
            const request = tx.objectStore('users').index('name').get(username);
            request.onsuccess = () => {
                this.getPromisedUserWithScans(resolve, tx, request.result);
            };
        });
    }
    getPromisedUserWithScans(resolve, tx, user) {
        if (!user) {
            return resolve(undefined);
        }
        const request = tx.objectStore('userScans').getAll(IDBKeyRange.bound([user.id, 0], [user.id, 1], false, true));
        request.onsuccess = () => {
            const scans = {};
            for (const scan of request.result) {
                scans[scan.type] = scan;
            }
            return resolve({ user, scans });
        };
    }
    getCurrentUserScan(type, uid) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction('userScans', 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getCurrentUserScan(): ${tx.error}`));
            const request = tx.objectStore('userScans').get([uid, 0, type]);
            request.onsuccess = () => resolve(request.result);
        });
    }
    getUserNames(uids) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction('users', 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getUserNames(): ${tx.error}`));
            const usernames = new Map();
            tx.oncomplete = () => resolve(usernames);
            const userStore = tx.objectStore('users');
            for (const uid of uids) {
                const request = userStore.get(uid);
                request.onsuccess = () => {
                    const user = request.result;
                    if (user == null || user.name == null)
                        return;
                    usernames.set(uid, user.name);
                };
            }
        });
    }
    getUserItems(type, uid, scan, streamBoundary, limit) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const commentsType = UserItemCommentStoreMap[type];
            const returnItems = (itemsWithComments) => {
                if (itemsWithComments.length == 0) { // can also check if items.length<limit
                    if (scan.endDate) {
                        streamBoundary.finish();
                    }
                    else if (!scan.empty) {
                        streamBoundary.advance(scan.lowerItemDate);
                    }
                }
                return resolve(itemsWithComments);
            };
            if (scan.empty) {
                return returnItems([]);
            }
            const scanBoundary = new ScanBoundary(scan);
            const range = scanBoundary.getItemKeyRange(uid, streamBoundary);
            if (!range) {
                return returnItems([]);
            }
            const tx = this.idb.transaction([type, commentsType], 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getUserItems(): ${tx.error}`));
            const itemsWithComments = [];
            tx.oncomplete = () => returnItems(itemsWithComments);
            const itemCommentStore = tx.objectStore(commentsType);
            const itemCursorRequest = tx.objectStore(type).index('user').openCursor(range, 'prev');
            let itemsCount = 0;
            itemCursorRequest.onsuccess = () => {
                const cursor = itemCursorRequest.result;
                if (!cursor)
                    return;
                const item = cursor.value;
                if (scanBoundary.isItemInside(item) && streamBoundary.visit(item.createdAt, item.id)) {
                    itemsCount++;
                    const itemCommentsRequest = itemCommentStore.getAll(this.getItemCommentsRange(item));
                    itemCommentsRequest.onsuccess = () => {
                        const comments = itemCommentsRequest.result;
                        itemsWithComments.push([item, comments]);
                    };
                }
                if (itemsCount < limit) {
                    cursor.continue();
                }
            };
        });
    }
    getSingleItemReader() {
        const makeItemReader = (type, fnName) => (id) => {
            if (this.closed)
                throw new Error(`Database is outdated, please reload the page.`);
            return new Promise((resolve, reject) => {
                const tx = this.idb.transaction(type, 'readonly');
                tx.onerror = () => reject(new Error(`Database error in SingleItemDBReader.${fnName}(): ${tx.error}`));
                const request = tx.objectStore(type).get(id);
                request.onsuccess = () => {
                    resolve(request.result);
                };
            });
        };
        const makeItemCommentReader = (type, fnName) => (itemId, order) => {
            if (this.closed)
                throw new Error(`Database is outdated, please reload the page.`);
            return new Promise((resolve, reject) => {
                const commentsType = UserItemCommentStoreMap[type];
                const tx = this.idb.transaction([commentsType, 'users'], 'readonly');
                tx.onerror = () => reject(new Error(`Database error in SingleItemDBReader.${fnName}(): ${tx.error}`));
                const commentRequest = tx.objectStore(commentsType).get([itemId, order]);
                commentRequest.onsuccess = () => {
                    const comment = commentRequest.result;
                    if (!comment)
                        return resolve({});
                    if (comment.uid == null)
                        return resolve({ comment });
                    const userRequest = tx.objectStore('users').get(comment.uid);
                    userRequest.onsuccess = () => {
                        const user = userRequest.result;
                        if (!user || user.name == null)
                            return resolve({ comment });
                        resolve({ comment, username: user.name });
                    };
                };
            });
        };
        return {
            getUser: async (id) => {
                const info = await this.getUserInfoById(id);
                if (!info)
                    return;
                return info.user;
            },
            getChangeset: makeItemReader('changesets', 'getChangeset'),
            getNote: makeItemReader('notes', 'getNote'),
            getChangesetComment: makeItemCommentReader('changesets', 'getChangesetComment'),
            getNoteComment: makeItemCommentReader('notes', 'getNoteComment')
        };
    }
    static open(host) {
        return this.openWithType(host, idb => new ChangesetViewerDBReader(idb));
    }
    static openWithType(host, ctor) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(`OsmChangesetViewer[${host}]`);
            request.onsuccess = () => {
                resolve(ctor(request.result));
            };
            request.onupgradeneeded = () => {
                const idb = request.result;
                const userStore = idb.createObjectStore('users', { keyPath: 'id' });
                userStore.createIndex('name', 'name');
                idb.createObjectStore('userScans', { keyPath: ['uid', 'stash', 'type'] });
                const changesetCommentStore = idb.createObjectStore('changesetComments', { keyPath: ['itemId', 'order'] });
                changesetCommentStore.createIndex('user', ['itemUid', 'createdAt', 'itemId', 'order']);
                const noteCommentStore = idb.createObjectStore('noteComments', { keyPath: ['itemId', 'order'] });
                noteCommentStore.createIndex('user', ['itemUid', 'createdAt', 'itemId', 'order']);
                const changesetStore = idb.createObjectStore('changesets', { keyPath: 'id' });
                changesetStore.createIndex('user', ['uid', 'createdAt', 'id']);
                const noteStore = idb.createObjectStore('notes', { keyPath: 'id' });
                noteStore.createIndex('user', ['uid', 'createdAt', 'id']);
            };
            request.onerror = () => {
                reject(new Error(`failed to open the database`));
            };
            request.onblocked = () => {
                reject(new Error(`failed to open the database because of blocked version change`)); // shouldn't happen
            };
        });
    }
    getItemCommentsRange(item) {
        return IDBKeyRange.bound([item.id], [item.id, +Infinity]);
    }
}

class StreamBoundary {
    constructor(init) {
        this.timestamp = +Infinity;
        this.visitedIds = new Set();
        if (init) {
            this.timestamp = init.date.getTime();
            this.visitedIds = new Set(init.visitedIds);
        }
    }
    advance(date) {
        const timestamp = date.getTime();
        if (timestamp < this.timestamp) {
            this.visitedIds.clear();
            this.timestamp = timestamp;
        }
    }
    visit(date, id) {
        this.advance(date);
        if (this.visitedIds.has(id)) {
            return false;
        }
        else {
            this.visitedIds.add(id);
            return true;
        }
    }
    finish() {
        this.timestamp = -Infinity;
    }
    get isFinished() {
        return this.timestamp == -Infinity;
    }
    get isStarted() {
        return this.timestamp < +Infinity;
    }
    get date() {
        if (this.timestamp >= 0 && this.timestamp < +Infinity) {
            return new Date(this.timestamp);
        }
        else {
            return null;
        }
    }
    get dateOneSecondBefore() {
        if (this.timestamp < +Infinity) {
            return new Date(this.timestamp + 1000);
        }
        else {
            return null;
        }
    }
    getOwnOrLowerDate(otherDate) {
        if (otherDate.getTime() < this.timestamp) {
            return otherDate;
        }
        else {
            return new Date(Math.max(0, this.timestamp));
        }
    }
}

class ChangesetViewerDBWriter extends ChangesetViewerDBReader {
    putUser(user) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction('users', 'readwrite');
            tx.onerror = () => reject(new Error(`Database error in putUser(): ${tx.error}`));
            tx.objectStore('users').put(user).onsuccess = () => resolve();
        });
    }
    getUserItemStreamBoundary(type, uid) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const tx = this.idb.transaction([type, 'userScans'], 'readonly');
            tx.onerror = () => reject(new Error(`Database error in getUserStreamResumeInfo(): ${tx.error}`));
            const scanRequest = tx.objectStore('userScans').get([uid, 0, type]);
            scanRequest.onsuccess = () => {
                if (scanRequest.result == null) {
                    return resolve(new StreamBoundary());
                }
                const scan = scanRequest.result;
                if (scan.empty) {
                    return resolve(new StreamBoundary());
                }
                const itemRequest = tx.objectStore(type).index('user').getAll(IDBKeyRange.bound([uid, scan.lowerItemDate], [uid, scan.lowerItemDate, +Infinity]));
                itemRequest.onsuccess = () => {
                    let lowerItemDate;
                    const itemIdsWithLowerDate = itemRequest.result.map((item) => {
                        if (!lowerItemDate || lowerItemDate.getTime() > item.createdAt.getTime()) {
                            lowerItemDate = item.createdAt;
                        }
                        return item.id;
                    });
                    if (lowerItemDate) {
                        resolve(new StreamBoundary({
                            date: lowerItemDate,
                            visitedIds: itemIdsWithLowerDate
                        }));
                    }
                    else {
                        resolve(new StreamBoundary());
                    }
                };
            };
        });
    }
    /**
     * Store items if they were acquired as a side effect of some other operation, like changesets when getting user info
     *
     * @returns true if decided to add/update the scan
     */
    addUserItemsIfNoScan(type, uid, now, itemInfos, streamBoundary) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const [tx, userStore, scanStore, itemStore, itemCommentStore] = this.openUserItemsTransaction(type, 'addUserItemsIfNoScan', reject);
            const handleScan = (scan) => {
                const updatedScan = this.addUserItemsToScan(now, itemInfos, streamBoundary, scan, itemStore, itemCommentStore);
                scanStore.put(updatedScan);
                this.putUserNames(now, mergeUserNamesFromItemInfos(itemInfos), userStore);
            };
            const getScanRequest = scanStore.get([uid, 0, type]);
            getScanRequest.onsuccess = () => {
                if (getScanRequest.result == null) {
                    handleScan(makeEmptyScan(uid, type, now));
                    tx.oncomplete = () => resolve(true);
                }
                else {
                    resolve(false);
                }
            };
        });
    }
    addUserItems(type, uid, now, itemInfos, streamBoundary, forceNewScan) {
        if (this.closed)
            throw new Error(`Database is outdated, please reload the page.`);
        return new Promise((resolve, reject) => {
            const [tx, userStore, scanStore, itemStore, itemCommentStore] = this.openUserItemsTransaction(type, 'addUserItems', reject);
            tx.oncomplete = () => resolve();
            const handleScan = (scan) => {
                const updatedScan = this.addUserItemsToScan(now, itemInfos, streamBoundary, scan, itemStore, itemCommentStore);
                scanStore.put(updatedScan);
                this.putUserNames(now, mergeUserNamesFromItemInfos(itemInfos), userStore);
            };
            if (forceNewScan) {
                handleScan(makeEmptyScan(uid, type, now));
            }
            else {
                const getScanRequest = scanStore.get([uid, 0, type]);
                getScanRequest.onsuccess = () => {
                    if (getScanRequest.result == null) {
                        handleScan(makeEmptyScan(uid, type, now));
                    }
                    else {
                        handleScan(getScanRequest.result);
                    }
                };
            }
        });
    }
    openUserItemsTransaction(type, callerName, reject) {
        const commentsType = UserItemCommentStoreMap[type];
        const tx = this.idb.transaction(['users', 'userScans', type, commentsType], 'readwrite');
        tx.onerror = () => reject(new Error(`Database error in ${callerName}(): ${tx.error}`));
        return [
            tx,
            tx.objectStore('users'),
            tx.objectStore('userScans'),
            tx.objectStore(type),
            tx.objectStore(commentsType),
        ];
    }
    addUserItemsToScan(now, itemsWithComments, streamBoundary, scan, itemStore, itemCommentStore) {
        for (const { item, comments } of itemsWithComments) {
            itemCommentStore.delete(this.getItemCommentsRange(item));
            itemStore.put(item);
            for (const comment of comments) {
                itemCommentStore.put(comment);
            }
            scan = addUserItemIdsAndDateToScan(scan, item.createdAt, [item.id]);
        }
        if (streamBoundary.date) {
            scan = addUserItemIdsAndDateToScan(scan, streamBoundary.date, []);
        }
        if (streamBoundary.isFinished) {
            scan.endDate = now;
        }
        else {
            delete scan.endDate;
        }
        return scan;
    }
    putUserNames(now, usernames, userStore) {
        for (const [id, name] of usernames) {
            const readRequest = userStore.get(id);
            readRequest.onsuccess = () => {
                const user = readRequest.result;
                if (user == null || !user.withDetails) {
                    const newUser = {
                        id,
                        nameUpdatedAt: now,
                        name,
                        withDetails: false
                    };
                    userStore.put(newUser);
                }
                else if (!user.visible) ;
                else {
                    const newUser = {
                        ...user,
                        nameUpdatedAt: now,
                        name
                    };
                    userStore.put(newUser);
                }
            };
        }
    }
    static open(host) {
        return this.openWithType(host, idb => new ChangesetViewerDBWriter(idb));
    }
}
function makeEmptyScan(uid, type, beginDate) {
    return {
        uid,
        type,
        stash: 0,
        items: { count: 0 },
        beginDate,
        empty: true
    };
}
function addUserItemIdsAndDateToScan(scan, itemDate, itemIds) {
    if (scan.empty ||
        scan.items.count == 0 &&
            scan.lowerItemDate.getTime() > itemDate.getTime() &&
            scan.upperItemDate.getTime() > itemDate.getTime() // move upper date down if no items is inside
    ) {
        scan = {
            ...scan,
            empty: false,
            upperItemDate: itemDate,
            upperItemIds: [...itemIds],
            lowerItemDate: itemDate,
            lowerItemIds: [...itemIds],
        };
    }
    else {
        if (scan.upperItemDate.getTime() < itemDate.getTime()) {
            scan = {
                ...scan,
                upperItemDate: itemDate,
                upperItemIds: [...itemIds],
            };
        }
        else if (scan.upperItemDate.getTime() == itemDate.getTime()) {
            scan = {
                ...scan,
                upperItemIds: [...itemIds, ...scan.upperItemIds],
            };
        }
        if (scan.lowerItemDate.getTime() > itemDate.getTime()) {
            scan = {
                ...scan,
                lowerItemDate: itemDate,
                lowerItemIds: [...itemIds],
            };
        }
        else if (scan.lowerItemDate.getTime() == itemDate.getTime()) {
            scan = {
                ...scan,
                lowerItemIds: [...itemIds, ...scan.lowerItemIds],
            };
        }
    }
    if (itemIds.length > 0) {
        scan = {
            ...scan,
            items: {
                count: scan.items.count + itemIds.length
            }
        };
    }
    return scan;
}
function mergeUserNamesFromItemInfos(itemInfos) {
    const allUsernames = new Map();
    for (const { usernames } of itemInfos) {
        for (const [uid, username] of usernames) {
            allUsernames.set(uid, username);
        }
    }
    return allUsernames;
}

function isObject(value) {
    return !!(value && typeof value == 'object');
}
function isArrayOfStrings(value) {
    return isArray(value) && value.every(item => typeof item == 'string');
}
function isArrayOfNumbers(value) {
    return isArray(value) && value.every(item => typeof item == 'number');
}
function isArray(value) {
    return Array.isArray(value);
}

function makeLink(text, href, title) {
    const $link = document.createElement('a');
    $link.href = href;
    $link.textContent = text;
    if (title != null)
        $link.title = title;
    return $link;
}

function makeEscapeTag(escapeFn) {
    return function (strings, ...values) {
        let result = strings[0];
        for (let i = 0; i < values.length; i++) {
            result += escapeFn(String(values[i])) + strings[i + 1];
        }
        return result;
    };
}

class QueryError {
    get reason() {
        return `for unknown reason`;
    }
}
class NetworkQueryError extends QueryError {
    constructor(message) {
        super();
        this.message = message;
    }
    get reason() {
        return `with the following error before receiving a response: ${this.message}`;
    }
}
class ResponseQueryError extends QueryError {
    constructor(text) {
        super();
        this.text = text;
    }
    get reason() {
        return `receiving the following message: ${this.text}`;
    }
}
class OsmProvider {
    get fetch() {
        let method;
        const headers = {};
        let body;
        const fetcher = (path, init) => {
            const hasHeaders = Object.keys(headers).length > 0;
            if (method != null || hasHeaders || body != null) {
                init = { ...init };
                if (method != null) {
                    init.method = method;
                }
                if (hasHeaders) {
                    init.headers = new Headers([
                        ...new Headers(headers),
                        ...new Headers(init.headers)
                    ]);
                }
                if (body != null && init.body == null) {
                    init.body = body;
                }
            }
            return fetch(this.getUrl(path), init);
        };
        fetcher.post = (path, init) => {
            method = 'POST';
            return fetcher(path, init);
        };
        fetcher.delete = (path, init) => {
            method = 'DELETE';
            return fetcher(path, init);
        };
        fetcher.withUrlencodedBody = (parameters) => {
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=utf-8';
            body = parameters.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
            return fetcher;
        };
        fetcher.withToken = (token) => {
            if (token)
                headers['Authorization'] = 'Bearer ' + token;
            return fetcher;
        };
        return fetcher;
    }
}
class WebProvider extends OsmProvider {
    constructor(urls) {
        super();
        this.urls = urls;
    }
    getUrl(path) {
        return `${this.urls[0]}${path}`;
    }
    getNoteLocationUrl(lat, lon) {
        return this.getUrl(`#map=15/${lat.toFixed(4)}/${lon.toFixed(4)}&layers=N`);
    }
    makeUserLink(uid, username) {
        const href = this.getUrl(`user/` + encodeURIComponent(username));
        const $a = makeLink(username, href);
        $a.classList.add('listened');
        $a.dataset.userName = username;
        $a.dataset.userId = String(uid);
        return $a;
    }
}
class ApiProvider extends OsmProvider {
    constructor(url) {
        super();
        this.url = url;
    }
    getUrl(path) {
        return `${this.url}api/0.6/${path}`;
    }
    getRootUrl(rootPath) {
        return `${this.url}${rootPath}`;
    }
}
class TileProvider {
    constructor(urlTemplate, attributionUrl, attributionText, maxZoom, owner) {
        this.urlTemplate = urlTemplate;
        this.attributionUrl = attributionUrl;
        this.attributionText = attributionText;
        this.maxZoom = maxZoom;
        this.owner = owner;
    }
}
class NominatimProvider {
    constructor(url) {
        this.url = url;
    }
    async search(parameters) {
        const response = await fetch(this.getSearchUrl(parameters));
        if (!response.ok) {
            throw new TypeError('unsuccessful Nominatim response');
        }
        return response.json();
    }
    getSearchUrl(parameters) {
        return this.url + `search?format=jsonv2&` + parameters;
    }
    get statusUrl() {
        return this.url + `status.php?format=json`;
    }
}
class OverpassProvider {
    constructor(url) {
        this.url = url;
    }
    async fetch(query) {
        try {
            let response;
            try {
                response = await fetch(this.url + `api/interpreter`, {
                    method: 'POST',
                    body: new URLSearchParams({ data: query })
                });
            }
            catch (ex) {
                if (ex instanceof TypeError) {
                    throw new NetworkQueryError(ex.message);
                }
                else {
                    throw ex;
                }
            }
            const text = await response.text();
            if (!response.ok) {
                throw new ResponseQueryError(text);
            }
            return new DOMParser().parseFromString(text, 'text/xml');
        }
        catch (ex) {
            if (ex instanceof QueryError) {
                throw ex;
            }
            else {
                throw new QueryError;
            }
        }
    }
    get statusUrl() {
        return this.url + `api/status`;
    }
}
class OverpassTurboProvider {
    constructor(url) {
        this.url = url;
    }
    getUrl(query, lat, lon, zoom) {
        const e = makeEscapeTag(encodeURIComponent);
        const location = `${lat};${lon};${zoom}`;
        return this.url + e `?C=${location}&Q=${query}`;
    }
}
class Server {
    constructor(host, apiUrl, webUrls, tileUrlTemplate, tileAttributionUrl, tileAttributionText, tileMaxZoom, tileOwner, nominatimUrl, overpassUrl, overpassTurboUrl, noteUrl, noteText, world, oauthId, 
    /**
      * App location registered with OSM server to receive auth redirects
      */
    oauthUrl) {
        this.host = host;
        this.noteUrl = noteUrl;
        this.noteText = noteText;
        this.world = world;
        this.oauthId = oauthId;
        this.oauthUrl = oauthUrl;
        this.web = new WebProvider(webUrls);
        this.api = new ApiProvider(apiUrl);
        this.tile = new TileProvider(tileUrlTemplate, tileAttributionUrl, tileAttributionText, tileMaxZoom, tileOwner);
        if (nominatimUrl != null)
            this.nominatim = new NominatimProvider(nominatimUrl);
        if (overpassUrl != null)
            this.overpass = new OverpassProvider(overpassUrl);
        if (overpassTurboUrl != null)
            this.overpassTurbo = new OverpassTurboProvider(overpassTurboUrl);
    }
}

function parseServerListSource(configSource) {
    if (Array.isArray(configSource)) {
        return configSource.map(parseServerListItem);
    }
    else {
        return [parseServerListItem(configSource)];
    }
}
function parseServerListItem(config) {
    let apiUrl;
    let webUrls;
    let tileUrlTemplate = `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
    let tileAttributionUrl = `https://www.openstreetmap.org/copyright`;
    let tileAttributionText = `OpenStreetMap contributors`;
    let tileMaxZoom = 19;
    let tileOwner = false;
    let nominatimUrl;
    let overpassUrl;
    let overpassTurboUrl;
    let noteUrl;
    let noteText;
    let world = 'earth';
    let oauthId;
    let oauthUrl;
    if (typeof config == 'string') {
        webUrls = [requireUrlStringProperty('web', config)];
    }
    else if (typeof config == 'object' && config) {
        if ('web' in config) {
            if (Array.isArray(config.web)) {
                if (config.web.length == 0)
                    throw new RangeError(`web property as array required to be non-empty`);
                webUrls = config.web.map(value => requireUrlStringProperty('web', value));
            }
            else {
                webUrls = [requireUrlStringProperty('web', config.web)];
            }
        }
        if ('api' in config) {
            apiUrl = requireUrlStringProperty('api', config.api);
        }
        if ('nominatim' in config) {
            nominatimUrl = requireUrlStringProperty('nominatim', config.nominatim);
        }
        if ('overpass' in config) {
            overpassUrl = requireUrlStringProperty('overpass', config.overpass);
        }
        if ('overpassTurbo' in config) {
            overpassTurboUrl = requireUrlStringProperty('overpassTurbo', config.overpassTurbo);
        }
        if ('tiles' in config) {
            tileOwner = true;
            tileAttributionUrl = tileAttributionText = undefined;
            if (typeof config.tiles == 'object' && config.tiles) {
                if ('template' in config.tiles) {
                    tileUrlTemplate = requireStringProperty('tiles.template', config.tiles.template);
                }
                if ('attribution' in config.tiles) {
                    [tileAttributionUrl, tileAttributionText] = parseUrlTextPair('tiles.attribution', tileAttributionUrl, tileAttributionText, config.tiles.attribution);
                }
                if ('zoom' in config.tiles) {
                    tileMaxZoom = requireNumberProperty('tiles.zoom', config.tiles.zoom);
                }
            }
            else {
                tileUrlTemplate = requireStringProperty('tiles', config.tiles);
            }
        }
        if ('world' in config) {
            world = requireStringProperty('world', config.world);
        }
        if ('note' in config) {
            [noteUrl, noteText] = parseUrlTextPair('note', noteUrl, noteText, config.note);
        }
        if ('oauth' in config) {
            if (!config.oauth || typeof config.oauth != 'object') {
                throw new RangeError(`oauth property required to be object`);
            }
            if ('id' in config.oauth) {
                oauthId = requireStringProperty('oauth.id', config.oauth.id);
            }
            else {
                throw new RangeError(`oauth property when defined required to contain id`);
            }
            if ('url' in config.oauth) {
                oauthUrl = requireStringProperty('oauth.url', config.oauth.url);
            }
        }
    }
    else if (config == null) {
        apiUrl = `https://api.openstreetmap.org/`;
        webUrls = [
            `https://www.openstreetmap.org/`,
            `https://openstreetmap.org/`,
            `https://www.osm.org/`,
            `https://osm.org/`,
        ];
        noteText = `main OSM server`;
        nominatimUrl = `https://nominatim.openstreetmap.org/`;
        overpassUrl = `https://www.overpass-api.de/`;
        overpassTurboUrl = `https://overpass-turbo.eu/`;
        tileOwner = true;
    }
    else {
        throw new RangeError(`server specification expected to be null, string or array; got ${type(config)} instead`);
    }
    if (!webUrls) {
        throw new RangeError(`missing required web property`);
    }
    let host;
    try {
        const hostUrl = new URL(webUrls[0]);
        host = hostUrl.host;
    }
    catch {
        throw new RangeError(`invalid web property value "${webUrls[0]}"`); // shouldn't happen
    }
    return [
        host,
        apiUrl ?? webUrls[0],
        webUrls,
        tileUrlTemplate,
        tileAttributionUrl ?? deriveAttributionUrl(webUrls),
        tileAttributionText ?? deriveAttributionText(webUrls),
        tileMaxZoom, tileOwner,
        nominatimUrl, overpassUrl, overpassTurboUrl,
        noteUrl, noteText,
        world,
        oauthId,
        oauthUrl
    ];
}
function requireUrlStringProperty(name, value) {
    if (typeof value != 'string')
        throw new RangeError(`${name} property required to be string; got ${type(value)} instead`);
    try {
        return new URL(value).href;
    }
    catch {
        throw new RangeError(`${name} property required to be url; got "${value}"`);
    }
}
function requireStringProperty(name, value) {
    if (typeof value != 'string')
        throw new RangeError(`${name} property required to be string; got ${type(value)} instead`);
    return value;
}
function requireNumberProperty(name, value) {
    if (typeof value != 'number')
        throw new RangeError(`${name} property required to be number; got ${type(value)} instead`);
    return value;
}
function deriveAttributionUrl(webUrls) {
    return webUrls[0] + `copyright`;
}
function deriveAttributionText(webUrls) {
    try {
        const hostUrl = new URL(webUrls[0]);
        return hostUrl.host + ` contributors`;
    }
    catch {
        return webUrls[0] + ` contributors`;
    }
}
function parseUrlTextPairItem(name, urlValue, textValue, newValue) {
    if (typeof newValue != 'string')
        throw new RangeError(`${name} array property requires all elements to be strings; got ${type(newValue)} instead`);
    try {
        const url = new URL(newValue);
        return [url.href, textValue];
    }
    catch {
        return [urlValue, newValue];
    }
}
function parseUrlTextPair(name, urlValue, textValue, newItems) {
    if (typeof newItems == 'string') {
        [urlValue, textValue] = parseUrlTextPairItem(name, urlValue, textValue, newItems);
    }
    else if (Array.isArray(newItems)) {
        for (const newValue of newItems) {
            [urlValue, textValue] = parseUrlTextPairItem(name, urlValue, textValue, newValue);
        }
    }
    else {
        throw new RangeError(`${name} property required to be string or array of strings; got ${type(newItems)} instead`);
    }
    return [urlValue, textValue];
}
function type(value) {
    if (Array.isArray(value)) {
        return 'array';
    }
    else if (value == null) {
        return 'null';
    }
    else {
        return typeof value;
    }
}

class ServerList {
    constructor(...configSources) {
        this.servers = new Map();
        [this.defaultServerListConfig] = configSources;
        for (const configSource of configSources) {
            try {
                const parametersList = parseServerListSource(configSource);
                for (const parameters of parametersList) {
                    const server = new Server(...parameters);
                    this.servers.set(server.host, server);
                }
            }
            catch { }
        }
        if (this.servers.size == 0) {
            const parameters = parseServerListItem(null); // shouldn't throw
            const server = new Server(...parameters);
            this.servers.set(server.host, server);
        }
        [this.defaultServer] = this.servers.values();
    }
}

class WorkerNet {
    constructor(serverListConfig) {
        const serverListConfigSources = [serverListConfig];
        // TODO receive updates to custom server config through worker messages
        // try {
        // 	const customServerListConfig=storage.getItem('servers')
        // 	if (customServerListConfig!=null) {
        // 		serverListConfigSources.push(JSON.parse(customServerListConfig))
        // 	}
        // } catch {}
        this.serverList = new ServerList(...serverListConfigSources);
    }
}

class WorkerBroadcastChannel {
    constructor(host) {
        this.broadcastChannel = new BroadcastChannel(`OsmChangesetViewer[${host}]`);
    }
}
class WorkerBroadcastSender extends WorkerBroadcastChannel {
    postMessage(message) {
        this.broadcastChannel.postMessage(message);
    }
    postOperationMessage(part) {
        this.postMessage({
            type: 'operation',
            part
        });
    }
}

function isOsmBaseApiData(d) {
    if (!d || typeof d != 'object')
        return false;
    if (!('id' in d) || !Number.isInteger(d.id))
        return false;
    if (('user' in d) && (typeof d.user != 'string'))
        return false;
    if (!('uid' in d) || !Number.isInteger(d.uid))
        return false;
    if (('tags' in d) && (typeof d.tags != 'object'))
        return false;
    return true;
}

function isOsmChangesetCommentApiData(c) {
    return (isObject(c) &&
        'date' in c && typeof c.date == 'string' &&
        (!('uid' in c) || Number.isInteger(c.uid)) &&
        (!('user' in c) || typeof c.user == 'string') &&
        (!('text' in c) || typeof c.text == 'string'));
}
function isOsmChangesetApiData(c) {
    if (!isOsmBaseApiData(c))
        return false;
    if (!('created_at' in c) || typeof c.created_at != 'string')
        return false;
    if (('closed_at' in c) && typeof c.closed_at != 'string')
        return false;
    if (!('comments_count' in c) || typeof c.comments_count != 'number')
        return false;
    if (!('changes_count' in c) || typeof c.changes_count != 'number')
        return false;
    if (('discussion' in c) && (!isArray(c.discussion) || !c.discussion.every(isOsmChangesetCommentApiData)))
        return false;
    return true;
}
function hasBbox(c) {
    if (!('minlat' in c) || !Number.isFinite(c.minlat))
        return false;
    if (!('maxlat' in c) || !Number.isFinite(c.maxlat))
        return false;
    if (!('minlon' in c) || !Number.isFinite(c.minlon))
        return false;
    if (!('maxlon' in c) || !Number.isFinite(c.maxlon))
        return false;
    return true;
}
function getChangesetFromOsmApiResponse(data) {
    if (!data || typeof data != 'object')
        throw new TypeError(`OSM API error: invalid response data`);
    let changeset;
    if ('changeset' in data) {
        changeset = data.changeset;
    }
    else if ('elements' in data) {
        if (!isArray(data.elements))
            throw new TypeError(`OSM API error: 'elements' is not an array in response data`);
        const changesetArray = data.elements;
        if (changesetArray.length != 1)
            throw new TypeError(`OSM API error: invalid number of changesets in response data`);
        changeset = changesetArray[0];
    }
    else {
        throw new TypeError(`OSM API error: no 'changeset' or 'elements' in response data`);
    }
    changeset = fixChangesetFormatDifferences(changeset);
    if (!isOsmChangesetApiData(changeset))
        throw new TypeError(`OSM API error: invalid changeset in response data`);
    return changeset;
}
function getChangesetsFromOsmApiResponse(data) {
    if (!data || typeof data != 'object')
        throw new TypeError(`OSM API error: invalid response data`);
    if (!('changesets' in data) || !isArray(data.changesets))
        throw new TypeError(`OSM API error: no changesets array in response data`);
    const changesetArray = data.changesets.map(fixChangesetFormatDifferences);
    if (!changesetArray.every(isOsmChangesetApiData))
        throw new TypeError(`OSM API error: invalid changeset in response data`);
    return changesetArray;
}
function fixChangesetFormatDifferences(inputChangeset) {
    if (!isObject(inputChangeset))
        return inputChangeset;
    let changeset = inputChangeset;
    if (('min_lat' in changeset) && !('minlat' in changeset)) {
        const { min_lat, ...rest } = changeset;
        changeset = { minlat: min_lat, ...rest };
    }
    if (('min_lon' in changeset) && !('minlon' in changeset)) {
        const { min_lon, ...rest } = changeset;
        changeset = { minlon: min_lon, ...rest };
    }
    if (('max_lat' in changeset) && !('maxlat' in changeset)) {
        const { max_lat, ...rest } = changeset;
        changeset = { maxlat: max_lat, ...rest };
    }
    if (('max_lon' in changeset) && !('maxlon' in changeset)) {
        const { max_lon, ...rest } = changeset;
        changeset = { maxlon: max_lon, ...rest };
    }
    if (('comments' in changeset) && !('discussion' in changeset)) {
        const { comments, ...rest } = changeset;
        changeset = { discussion: comments, ...rest };
    }
    return changeset;
}

function isOsmNoteCommentApiData(c) {
    return (isObject(c) &&
        'date' in c && typeof c.date == 'string' &&
        (!('uid' in c) || Number.isInteger(c.uid)) &&
        (!('user' in c) || typeof c.user == 'string') &&
        'action' in c && typeof c.action == 'string' &&
        (!('text' in c) || typeof c.text == 'string'));
}
function isOsmNoteApiData(n) {
    if (!isObject(n))
        return false;
    // if (!('type' in n) || n.type!='Feature') return false
    if (!('geometry' in n) || !isObject(n.geometry))
        return false;
    if (!('coordinates' in n.geometry) || !isArrayOfNumbers(n.geometry.coordinates) || n.geometry.coordinates.length < 2)
        return false;
    if (!('properties' in n) || !isObject(n.properties))
        return false;
    if (!('id' in n.properties) || !Number.isInteger(n.properties.id))
        return false;
    if (!('date_created' in n.properties) || typeof n.properties.date_created != 'string')
        return false;
    if (!('status' in n.properties) || typeof n.properties.status != 'string')
        return false;
    if (!('comments' in n.properties) || !isArray(n.properties.comments))
        return false;
    if (!n.properties.comments.every(isOsmNoteCommentApiData))
        return false;
    return true;
}
function getNotesFromOsmApiResponse(data) {
    if (!isObject(data))
        throw new TypeError(`OSM API error: invalid response data`);
    if (!('features' in data) || !isArray(data.features))
        throw new TypeError(`OSM API error: no features array in response data`);
    const noteArray = data.features;
    if (!noteArray.every(isOsmNoteApiData))
        throw new TypeError(`OSM API error: invalid note feature in response data`);
    return noteArray;
}

function isCounter(c) {
    return isObject(c) && 'count' in c && Number.isInteger(c.count);
}
function isActiveCounter(c) {
    return isCounter(c) && 'active' in c && Number.isInteger(c.active);
}
function isOsmUserApiData(u) {
    if (!isObject(u))
        return false;
    if (!('id' in u) || !Number.isInteger(u.id))
        return false;
    if (!('display_name' in u) || typeof u.display_name != 'string')
        return false;
    if (!('account_created' in u) || typeof u.account_created != 'string')
        return false;
    if (('description' in u) && typeof u.description != 'string')
        return false;
    if (!('contributor_terms' in u) || !isObject(u.contributor_terms) || !('agreed' in u.contributor_terms) || typeof u.contributor_terms.agreed != 'boolean')
        return false;
    if (('img' in u) && (!isObject(u.img) || !('href' in u.img) || typeof u.img.href != 'string'))
        return false;
    if (!('roles' in u) || !isArrayOfStrings(u.roles))
        return false;
    if (!('changesets' in u) || !isCounter(u.changesets))
        return false;
    if (!('traces' in u) || !isCounter(u.traces))
        return false;
    if (!('blocks' in u) || !isObject(u.blocks))
        return false;
    if (!('received' in u.blocks) || !isActiveCounter(u.blocks.received))
        return false;
    if (('issued' in u.blocks) && !isActiveCounter(u.blocks.issued))
        return false;
    return true;
}
function getUserFromOsmApiResponse(data) {
    if (!isObject(data))
        throw new TypeError(`OSM API error: invalid response data`);
    if (!('user' in data))
        throw new TypeError(`OSM API error: no user in response data`);
    if (!isOsmUserApiData(data.user))
        throw new TypeError(`OSM API error: invalid user in response data`);
    return data.user;
}

const pad = (n) => ('0' + n).slice(-2);
function toIsoDateString(date, separator = '-') {
    return (date.getUTCFullYear() + separator +
        pad(date.getUTCMonth() + 1) + separator +
        pad(date.getUTCDate()));
}
function toIsoTimeString(date, separator = ':') {
    return (pad(date.getUTCHours()) + separator +
        pad(date.getUTCMinutes()) + separator +
        pad(date.getUTCSeconds()));
}
function toIsoString(date, dateSeparator = '-', timeSeparator = ':', dateTimeSeparator = 'T', utcSuffix = 'Z') {
    return (toIsoDateString(date, dateSeparator) +
        dateTimeSeparator +
        toIsoTimeString(date, timeSeparator) +
        utcSuffix);
}
function toReadableIsoString(date) {
    return toIsoString(date, '-', ':', ' ', '');
}

const e$1 = makeEscapeTag(encodeURIComponent);
const pastDateString = `20010101T000000Z`;
class UserItemStream {
    constructor(userQuery, boundary) {
        this.userQuery = userQuery;
        if (boundary) {
            this.boundary = boundary;
        }
        else {
            this.boundary = new StreamBoundary();
        }
    }
    async fetch(fetcher) {
        const path = this.getFetchPath(this.nextFetchUpperBoundDate);
        const json = await this.fetchJson(fetcher, path);
        const items = this.getOsmDataFromResponseJson(json);
        const newItems = [];
        let fetchedNewItems = false;
        for (let item of items) {
            const id = this.getItemId(item);
            const date = this.getItemDate(item);
            if (!this.boundary.visit(date, id))
                continue;
            fetchedNewItems = true;
            if (!this.acceptItem(item))
                continue;
            const additionalPath = this.getFullFetchPathIfRequired(item);
            if (additionalPath) {
                const json = await this.fetchJson(fetcher, additionalPath);
                item = this.getFullOsmDataFromResponseJson(json);
            }
            this.modifyQueryInResponseToFetchedData(item);
            newItems.push(item);
        }
        if (!fetchedNewItems) {
            this.boundary.finish();
        }
        return newItems;
    }
    get nextFetchUpperBoundDate() {
        return this.boundary.dateOneSecondBefore;
    }
    get userParameter() {
        if (this.userQuery.type == 'id') {
            return e$1 `user=${this.userQuery.uid}`;
        }
        else {
            return e$1 `display_name=${this.userQuery.username}`;
        }
    }
    getFullFetchPathIfRequired(item) { return null; }
    getFullOsmDataFromResponseJson(json) { throw new TypeError(`unexpected request for full osm item data`); }
    modifyQueryInResponseToFetchedData(item) { }
    acceptItem(item) { return true; }
    async fetchJson(fetcher, path) {
        let response;
        try {
            response = await fetcher(path);
        }
        catch (ex) {
            throw new TypeError(`network error`);
        }
        if (!response.ok) {
            if (response.status == 404) {
                throw new TypeError(`user not found / didn't agree to contributor terms`);
            }
            else {
                throw new TypeError(`unsuccessful response from OSM API`);
            }
        }
        return await response.json();
    }
}
class UserChangesetStream extends UserItemStream {
    getFetchPath(upperBoundDate) {
        let timeParameter = '';
        if (upperBoundDate) {
            timeParameter = e$1 `&time=${pastDateString},${toIsoString(upperBoundDate, '', '')}`;
        }
        return `changesets.json?${this.userParameter}${timeParameter}`;
    }
    getFullFetchPathIfRequired(changeset) {
        if (changeset.comments_count <= 0)
            return null;
        return e$1 `changeset/${changeset.id}.json?include_discussion=true`;
    }
    getOsmDataFromResponseJson(json) {
        return getChangesetsFromOsmApiResponse(json);
    }
    getFullOsmDataFromResponseJson(json) {
        return getChangesetFromOsmApiResponse(json);
    }
    modifyQueryInResponseToFetchedData(changeset) {
        if (this.userQuery.type == 'name') {
            this.userQuery = {
                type: 'id',
                uid: changeset.uid
            };
        }
    }
    getItemId(changeset) {
        return changeset.id;
    }
    getItemDate(changeset) {
        return new Date(changeset.created_at);
    }
}
class UserNoteStream extends UserItemStream {
    getFetchPath(upperBoundDate) {
        let timeParameter = '';
        if (upperBoundDate) {
            timeParameter = e$1 `&from=${pastDateString}&to=${toIsoString(upperBoundDate, '', '')}`;
        }
        return `notes/search.json?${this.userParameter}&sort=created_at&closed=-1${timeParameter}`;
    }
    getOsmDataFromResponseJson(json) {
        return getNotesFromOsmApiResponse(json);
    }
    acceptItem(note) {
        if (note.properties.comments.length == 0)
            return false;
        const [openingComment] = note.properties.comments;
        if (openingComment.action != 'opened')
            return false;
        if (this.userQuery.type == 'id') {
            return openingComment.uid == this.userQuery.uid;
        }
        else {
            return openingComment.user == this.userQuery.username;
        }
    }
    getItemId(note) {
        return note.properties.id;
    }
    getItemDate(note) {
        return parseNoteDate(note.properties.date_created);
    }
}
function parseNoteDate(a) {
    const match = a.match(/^\d\d\d\d-\d\d-\d\d\s+\d\d:\d\d:\d\d/);
    if (!match)
        throw new RangeError(`invalid date format`);
    const [s] = match;
    return new Date(s + 'Z');
}

var serverListConfig = [
    {
        "web": [
            "https://www.openstreetmap.org/",
            "https://openstreetmap.org/",
            "https://www.osm.org/",
            "https://osm.org/"
        ],
        "api": "https://api.openstreetmap.org/",
        "nominatim": "https://nominatim.openstreetmap.org/",
        "overpass": "https://www.overpass-api.de/",
        "overpassTurbo": "https://overpass-turbo.eu/",
        "tiles": {
            "template": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "attribution": "OpenStreetMap contributors"
        },
        "note": "main OSM server"
    },
    {
        "web": "https://master.apis.dev.openstreetmap.org/",
        "note": [
            "OSM sandbox/development server",
            "https://wiki.openstreetmap.org/wiki/Sandbox_for_editing#Experiment_with_the_API_(advanced)"
        ]
    },
    {
        "web": [
            "https://www.openhistoricalmap.org/",
            "https://openhistoricalmap.org/"
        ],
        "nominatim": "https://nominatim.openhistoricalmap.org/",
        "overpass": "https://overpass-api.openhistoricalmap.org/",
        "overpassTurbo": "https://openhistoricalmap.github.io/overpass-turbo/"
    },
    {
        "web": "https://opengeofiction.net/",
        "tiles": {
            "template": "https://tiles04.rent-a-planet.com/ogf-carto/{z}/{x}/{y}.png",
            "attribution": "OpenGeofiction and contributors"
        },
        "overpass": "https://overpass.ogf.rent-a-planet.com/",
        "overpassTurbo": "https://turbo.ogf.rent-a-planet.com/",
        "world": "opengeofiction"
    },
    {
        "web": "https://fosm.org/",
        "tiles": {
            "template": "https://map.fosm.org/default/{z}/{x}/{y}.png",
            "attribution": "https://fosm.org/",
            "zoom": 18
        },
        "note": "uses old OSM APIs, probably won't work"
    },
    {
        "web": "http://127.0.0.1:3000/",
        "note": "default local rails dev server"
    }
];

const e = makeEscapeTag(encodeURIComponent);
const net = new WorkerNet(serverListConfig);
const hostData = new Map();
async function getHostDataEntry(host) {
    let hostDataEntry = hostData.get(host);
    if (!hostDataEntry) {
        hostDataEntry = {
            broadcastSender: new WorkerBroadcastSender(host),
            db: await ChangesetViewerDBWriter.open(host),
            userStreams: {
                changesets: new Map(),
                notes: new Map()
            }
        };
        hostData.set(host, hostDataEntry);
    }
    return hostDataEntry;
}
function getLoggedFetcher(server, hostDataEntry) {
    return path => {
        hostDataEntry.broadcastSender.postMessage({
            type: 'log',
            part: {
                type: 'fetch',
                path
            }
        });
        return server.api.fetch(path);
    };
}
self.onconnect = ev => {
    const port = ev.ports[0];
    port.onmessage = async (ev) => {
        const type = ev.data.type;
        if (typeof type != 'string')
            throw new TypeError(`invalid message type`);
        if (type == 'getUserInfo') {
            const host = ev.data.host;
            if (typeof host != 'string')
                throw new TypeError(`invalid host type`);
            const server = net.serverList.servers.get(host);
            if (!server)
                throw new RangeError(`unknown host "${host}"`);
            const hostDataEntry = await getHostDataEntry(host);
            const fetcher = getLoggedFetcher(server, hostDataEntry);
            const query = ev.data.query;
            let changesetStream;
            let changesetsApiData = [];
            let uid;
            let text = `info of unknown user`;
            let failedText = `unable to get user id`;
            if (query.type == 'name') {
                text = `info of user "${query.username}"`;
                hostDataEntry.broadcastSender.postOperationMessage({
                    type, query, text,
                    status: 'running',
                });
                changesetStream = new UserChangesetStream(query);
                try {
                    changesetsApiData = await changesetStream.fetch(fetcher);
                }
                catch (ex) {
                    if (ex instanceof TypeError) {
                        failedText += ` because: ${ex.message}`;
                    }
                }
                if (changesetsApiData.length > 0) {
                    uid = changesetsApiData[0].uid;
                }
                else {
                    failedText += ` because user has no changesets`;
                }
            }
            else if (query.type == 'id') {
                text = `info of user #${query.uid}`;
                hostDataEntry.broadcastSender.postMessage({ type: 'operation', part: {
                        type, query, text,
                        status: 'running',
                    } });
                uid = query.uid;
            }
            if (uid == null) {
                return hostDataEntry.broadcastSender.postOperationMessage({
                    type, query, text,
                    status: 'failed',
                    failedText
                });
            }
            failedText = `unable to get user info for given id`;
            let user;
            const now = new Date();
            try {
                const response = await fetcher(e `user/${uid}.json`);
                if (!response.ok) {
                    if (response.status == 410) { // deleted/suspended user
                        user = {
                            id: uid,
                            nameUpdatedAt: now,
                            detailsUpdatedAt: now,
                            withDetails: true,
                            visible: false,
                        };
                        if (query.type == 'name') {
                            user.name = query.username;
                        }
                    }
                    else if (response.status == 404) {
                        failedText += ` because it doesn't exist`;
                    }
                }
                else {
                    const json = await response.json();
                    const userApiData = getUserFromOsmApiResponse(json);
                    user = {
                        id: uid,
                        nameUpdatedAt: now,
                        detailsUpdatedAt: now,
                        withDetails: true,
                        visible: true,
                        name: userApiData.display_name,
                        createdAt: new Date(userApiData.account_created),
                        roles: userApiData.roles,
                        changesets: userApiData.changesets,
                        traces: userApiData.traces,
                        blocks: userApiData.blocks
                    };
                    if (userApiData.description != null)
                        user.description = userApiData.description;
                    if (userApiData.img != null)
                        user.img = userApiData.img;
                }
            }
            catch { }
            if (user == null) {
                return hostDataEntry.broadcastSender.postOperationMessage({
                    type, query, text,
                    status: 'failed',
                    failedText
                });
            }
            await hostDataEntry.db.putUser(user);
            if (changesetStream) {
                const changesetsWithComments = changesetsApiData.map(convertChangesetApiDataToDbRecordWithComments);
                const restartedScan = await hostDataEntry.db.addUserItemsIfNoScan('changesets', user.id, now, changesetsWithComments, changesetStream.boundary);
                if (restartedScan) {
                    hostDataEntry.userStreams.changesets.set(user.id, changesetStream);
                }
            }
            hostDataEntry.broadcastSender.postOperationMessage({
                type, query, text,
                status: 'ready'
            });
        }
        else if (type == 'scanUserItems') {
            const host = ev.data.host;
            if (typeof host != 'string')
                throw new TypeError(`invalid host type`);
            const start = ev.data.start;
            if (typeof start != 'boolean')
                throw new TypeError(`invalid start type`);
            const itemType = ev.data.itemType;
            if (typeof itemType != 'string')
                throw new TypeError(`invalid itemType type`);
            if (itemType != 'changesets' && itemType != 'notes')
                throw new TypeError(`invalid itemType value`);
            const uid = ev.data.uid;
            if (typeof uid != 'number')
                throw new TypeError(`invalid uid type`);
            await scanUserItems(itemType, host, start, uid);
        }
    };
};
async function scanUserItems(itemType, host, start, uid) {
    const type = 'scanUserItems';
    const server = net.serverList.servers.get(host);
    if (!server)
        throw new RangeError(`unknown host "${host}"`);
    const hostDataEntry = await getHostDataEntry(host);
    const fetcher = getLoggedFetcher(server, hostDataEntry);
    const stream = await resumeUserItemStream(itemType, hostDataEntry, server.api, start, uid);
    const text = `${start ? `start ` : ``}scan ${stream.nextFetchUpperBoundDate
        ? `${itemType} before ` + toReadableIsoString(stream.nextFetchUpperBoundDate)
        : `latest ${itemType}`} of user #${uid}`;
    hostDataEntry.broadcastSender.postOperationMessage({
        type, uid, text,
        status: 'running',
    });
    const now = new Date();
    let userItemsApiData = [];
    try {
        userItemsApiData = await stream.fetch(fetcher);
    }
    catch (ex) {
        const failedText = (ex instanceof TypeError) ? ex.message : `unknown error`;
        return hostDataEntry.broadcastSender.postOperationMessage({
            type, uid, text,
            status: 'failed',
            failedText
        });
    }
    let userItemDbInfos;
    if (itemType == 'changesets') {
        const changesetsApiData = userItemsApiData;
        const changesetInfos = changesetsApiData.map(convertChangesetApiDataToDbRecordWithComments);
        userItemDbInfos = changesetInfos;
    }
    else if (itemType == 'notes') {
        const notesApiData = userItemsApiData;
        const noteInfos = notesApiData.map(convertNoteApiDataToDbRecordWithComments);
        userItemDbInfos = noteInfos;
    }
    else {
        throw new RangeError(`unexpected item type`);
    }
    await hostDataEntry.db.addUserItems(itemType, uid, now, userItemDbInfos, stream.boundary, start);
    hostDataEntry.broadcastSender.postOperationMessage({
        type, uid, text,
        status: 'ready'
    });
}
function makeNewUserItemStream(itemType, api, uid, streamBoundary) {
    if (itemType == 'changesets') {
        return new UserChangesetStream({ type: 'id', uid }, streamBoundary);
    }
    else if (itemType == 'notes') {
        return new UserNoteStream({ type: 'id', uid }, streamBoundary);
    }
    else {
        throw new RangeError(`unknown item type`);
    }
}
async function resumeUserItemStream(itemType, hostDataEntry, api, start, uid) {
    const userStreamsOfType = hostDataEntry.userStreams[itemType];
    const makeAndRememberNewStream = (streamBoundary) => {
        const newStream = makeNewUserItemStream(itemType, api, uid, streamBoundary);
        userStreamsOfType.set(uid, newStream);
        return newStream;
    };
    if (start)
        return makeAndRememberNewStream();
    return userStreamsOfType.get(uid) ?? makeAndRememberNewStream(await hostDataEntry.db.getUserItemStreamBoundary(itemType, uid));
}
function convertChangesetApiDataToDbRecordWithComments(a) {
    const usernames = new Map();
    const comments = [];
    const commentRefs = [];
    const makeCommentRef = (c) => {
        const commentRef = {};
        if (c.uid != null) {
            commentRef.uid = c.uid;
        }
        return commentRef;
    };
    if (a.discussion) {
        const apiComments = a.discussion;
        const iFirstComment = 0;
        for (const [i, ac] of apiComments.entries()) {
            if (i < iFirstComment)
                continue;
            const comment = {
                itemId: a.id,
                order: i - iFirstComment,
                itemUid: a.uid,
                createdAt: new Date(ac.date),
                text: ac.text,
            };
            if (ac.uid != null) {
                comment.uid = ac.uid;
                if (ac.user != null) {
                    usernames.set(ac.uid, ac.user);
                }
            }
            if (i > iFirstComment) {
                comment.prevCommentRef = makeCommentRef(apiComments[i - 1]);
            }
            if (i < apiComments.length - 1) {
                comment.nextCommentRef = makeCommentRef(apiComments[i + 1]);
            }
            comments.push(comment);
            commentRefs.push(makeCommentRef(ac));
        }
    }
    const item = {
        id: a.id,
        uid: a.uid,
        createdAt: new Date(a.created_at),
        tags: a.tags ?? {},
        changes: { count: a.changes_count },
        commentRefs
    };
    if (a.closed_at != null) {
        item.closedAt = new Date(a.closed_at);
    }
    if (hasBbox(a)) {
        item.bbox = {
            minLat: a.minlat, maxLat: a.maxlat,
            minLon: a.minlon, maxLon: a.maxlon,
        };
    }
    return { item, comments, usernames };
}
function convertNoteApiDataToDbRecordWithComments(a) {
    if (a.properties.comments.length == 0)
        throw new RangeError(`unexpected note without comments`);
    const [ac0] = a.properties.comments;
    if (ac0.uid == null)
        throw new RangeError(`unexpected note without an author`);
    const usernames = new Map();
    const comments = [];
    const commentRefs = [];
    const makeCommentRef = (c) => {
        const commentRef = {
            mute: !c.text,
            action: c.action,
        };
        if (c.uid != null) {
            commentRef.uid = c.uid;
        }
        return commentRef;
    };
    const apiComments = a.properties.comments;
    const iFirstComment = 1; // 0th comment already saved as item.openingComment
    for (const [i, ac] of apiComments.entries()) {
        if (i < iFirstComment)
            continue;
        const comment = {
            itemId: a.properties.id,
            order: i - iFirstComment,
            itemUid: ac0.uid,
            createdAt: parseNoteDate(ac.date),
            text: ac.text ?? '',
            action: ac.action,
        };
        if (ac.uid != null) {
            comment.uid = ac.uid;
            if (ac.user != null) {
                usernames.set(ac.uid, ac.user);
            }
        }
        if (i > iFirstComment) {
            comment.prevCommentRef = makeCommentRef(apiComments[i - 1]);
        }
        if (i < apiComments.length - 1) {
            comment.nextCommentRef = makeCommentRef(apiComments[i + 1]);
        }
        comments.push(comment);
        commentRefs.push(makeCommentRef(ac));
    }
    const item = {
        id: a.properties.id,
        uid: ac0.uid,
        createdAt: parseNoteDate(a.properties.date_created),
        lat: a.geometry.coordinates[1],
        lon: a.geometry.coordinates[0],
        commentRefs
    };
    if (ac0.text != null) {
        item.openingComment = ac0.text;
    }
    return { item, comments, usernames };
}
