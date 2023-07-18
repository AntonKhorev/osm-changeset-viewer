class Colorizer {
    constructor() {
        this.huesForUids = new Map();
    }
    getHueForUid(uid) {
        const storedHue = this.huesForUids.get(uid);
        return storedHue ?? uid % 360;
    }
    setHueForUid(uid, hue) {
        this.huesForUids.set(uid, hue);
    }
}

class Connection {
    constructor(server, authStorage) {
        this.server = server;
        this.authStorage = authStorage;
    }
    get token() {
        return this.authStorage.token;
    }
    get username() {
        return this.authStorage.login?.username;
    }
    get uid() {
        return this.authStorage.login?.uid;
    }
    get isModerator() {
        return this.authStorage.login?.roles?.includes('moderator') ?? false;
    }
}

function getStorageString(storage, k) {
    return storage.getItem(k) ?? '';
}
function setStorageString(storage, k, v) {
    if (v != '') {
        storage.setItem(k, v);
    }
    else {
        storage.removeItem(k);
    }
}
function getStorageBoolean(storage, k) {
    return !!storage.getItem(k);
}
function setStorageBoolean(storage, k, v) {
    if (v) {
        storage.setItem(k, '1');
    }
    else {
        storage.removeItem(k);
    }
}
class PrefixedLocalStorage {
    constructor(prefix) {
        this.prefix = prefix;
    }
    getItem(k) {
        return localStorage.getItem(this.prefix + k);
    }
    setItem(k, v) {
        localStorage.setItem(this.prefix + k, v);
    }
    removeItem(k) {
        localStorage.removeItem(this.prefix + k);
    }
    getKeys() {
        const result = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k?.startsWith(this.prefix))
                continue;
            result.push(k.substring(this.prefix.length));
        }
        return result;
    }
    clear() {
        for (const k of this.getKeys()) {
            this.removeItem(k);
        }
    }
}

function isArrayOfStrings(value) {
    return isArray(value) && value.every(item => typeof item == 'string');
}
function isArray(value) {
    return Array.isArray(value);
}
function moveInArray(a, iFrom, iTo) {
    a.splice(iTo, 0, ...a.splice(iFrom, 1));
}

function makeLogin$1(data) {
    if (!data || typeof data != 'object' ||
        !('scope' in data) || typeof data.scope != 'string' ||
        !('uid' in data) || typeof data.uid != 'number' ||
        !('username' in data) || typeof data.username != 'string')
        throw new TypeError(`Invalid login data`);
    const login = {
        scope: data.scope,
        uid: data.uid,
        username: data.username
    };
    if (('roles' in data) && isArrayOfStrings(data.roles)) {
        login.roles = data.roles;
    }
    return login;
}
class AuthStorage {
    constructor(storage, host, installUri) {
        this.storage = storage;
        this.host = host;
        this.installUri = installUri;
        this.manualCodeUri = `urn:ietf:wg:oauth:2.0:oob`;
    }
    get prefix() {
        return `host[${this.host}].`;
    }
    get clientId() {
        return getStorageString(this.storage, `${this.prefix}clientId`);
    }
    set clientId(clientId) {
        setStorageString(this.storage, `${this.prefix}clientId`, clientId);
    }
    get isManualCodeEntry() {
        return getStorageBoolean(this.storage, `${this.prefix}isManualCodeEntry`);
    }
    set isManualCodeEntry(isManualCodeEntry) {
        setStorageBoolean(this.storage, `${this.prefix}isManualCodeEntry`, isManualCodeEntry);
    }
    get token() {
        return getStorageString(this.storage, `${this.prefix}token`);
    }
    set token(token) {
        setStorageString(this.storage, `${this.prefix}token`, token);
    }
    get redirectUri() {
        return this.isManualCodeEntry ? this.manualCodeUri : this.installUri;
    }
    getLogins() {
        const logins = new Map;
        const loginsString = this.storage.getItem(`${this.prefix}logins`);
        if (loginsString == null)
            return logins;
        let loginsArray;
        try {
            loginsArray = JSON.parse(loginsString);
        }
        catch { }
        if (!isArray(loginsArray))
            return logins;
        for (const loginsArrayEntry of loginsArray) {
            if (!isArray(loginsArrayEntry))
                continue;
            const [token, loginData] = loginsArrayEntry;
            if (typeof token != 'string')
                continue;
            try {
                const login = makeLogin$1(loginData);
                logins.set(token, login);
            }
            catch { }
        }
        return logins;
    }
    setLogin(token, login) {
        const logins = this.getLogins();
        logins.set(token, login);
        this.setLoginsStorageItem(logins);
    }
    deleteLogin(token) {
        const logins = this.getLogins();
        logins.delete(token);
        this.setLoginsStorageItem(logins);
    }
    get login() {
        return this.getLogins().get(this.token);
    }
    setLoginsStorageItem(logins) {
        this.storage.setItem(`${this.prefix}logins`, JSON.stringify([...logins.entries()]));
    }
}

function makeLink(text, href, title) {
    const $link = document.createElement('a');
    $link.href = href;
    $link.textContent = text;
    if (title != null)
        $link.title = title;
    return $link;
}
function makeElement(tag) {
    return (...classes) => (...items) => {
        const $element = document.createElement(tag);
        if (classes.length > 0)
            $element.classList.add(...classes);
        $element.append(...items);
        return $element;
    };
}
const makeDiv = makeElement('div');
const makeLabel = makeElement('label');
function removeInlineElement($e) {
    const $s1 = $e.previousSibling;
    const $s2 = $e.nextSibling;
    if ($s1?.nodeType == document.TEXT_NODE && $s1.textContent == ' ') {
        $s1.remove();
    }
    else if ($s2?.nodeType == document.TEXT_NODE && $s2.textContent == ' ') {
        $s2.remove();
    }
    $e.remove();
}
async function wrapFetch($actionButton, action, getErrorMessage, $errorClassReceiver, writeErrorMessage) {
    try {
        $actionButton.disabled = true;
        $errorClassReceiver.classList.remove('error');
        writeErrorMessage('');
        await action();
    }
    catch (ex) {
        $errorClassReceiver.classList.add('error');
        writeErrorMessage(getErrorMessage(ex));
    }
    finally {
        $actionButton.disabled = false;
    }
}
function wrapFetchForButton($actionButton, action, getErrorMessage) {
    return wrapFetch($actionButton, action, getErrorMessage, $actionButton, message => $actionButton.title = message);
}
function makeGetKnownErrorMessage(KnownError // KnownError: typeof TypeError,
) {
    return (ex) => {
        if (ex instanceof TypeError && ex instanceof KnownError) {
            return ex.message;
        }
        else {
            return `Unknown error ${ex}`;
        }
    };
}

function escapeHash(text) {
    // fns escape all chars but:
    // encodeURIComponent: A–Za–z0–9-_.!~*'()
    // encodeURI:          A–Za–z0–9-_.!~*'();/?:@$+,&=#
    // we need:            A-Za-z0-9-_.!~*'();/?:@$+,
    // we need anything allowed in url hash except & and = https://stackoverflow.com/a/26119120
    return encodeURI(text).replace(/[&=#]/g, c => encodeURIComponent(c));
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

// can't use URLSearchParams for encoding because of different escaping
function getHashFromLocation() {
    return (location.hash[0] == '#'
        ? location.hash.slice(1)
        : location.hash);
}
function detachValueFromHash(key, hash) {
    let metKey = false;
    let value = null;
    const restParts = [];
    for (const part of hash.split('&')) {
        if (metKey) {
            restParts.push(part);
            continue;
        }
        const detectedValue = new URLSearchParams(part).get(key);
        if (detectedValue == null) {
            restParts.push(part);
        }
        else {
            value = detectedValue;
            metKey = true;
        }
    }
    return [value, restParts.join('&')];
}
function attachValueToFrontOfHash(key, value, restOfHash) {
    if (value == null)
        return restOfHash;
    const valueHash = `${key}=${escapeHash(value)}`;
    if (!restOfHash)
        return valueHash;
    return `${valueHash}&${restOfHash}`;
}
function attachValueToBackOfHash(key, value, restOfHash) {
    if (value == null)
        return restOfHash;
    const valueHash = `${key}=${escapeHash(value)}`;
    if (!restOfHash)
        return valueHash;
    return `${restOfHash}&${valueHash}`;
}

const em = (...ss) => makeElement('em')()(...ss);
const strong = (...ss) => makeElement('strong')()(...ss);
const code = (...ss) => makeElement('code')()(...ss);
const mark = (...ss) => makeElement('mark')()(...ss);
const p = (...ss) => makeElement('p')()(...ss);
const ul = (...ss) => makeElement('ul')()(...ss);
const ol = (...ss) => makeElement('ol')()(...ss);
const li = (...ss) => makeElement('li')()(...ss);

class HashServerSelector {
    constructor(serverList) {
        this.serverList = serverList;
        const hash = getHashFromLocation();
        [this.hostHashValue] = detachValueFromHash('host', hash);
    }
    // generic server selector methods
    selectServer() {
        return this.getServerForHostHashValue(this.hostHashValue);
    }
    getServerSelectHref(server) {
        const baseLocation = location.pathname + location.search;
        const hashValue = this.getHostHashValueForServer(server);
        return baseLocation + (hashValue ? `#host=` + escapeHash(hashValue) : '');
    }
    addServerSelectToAppInstallLocationHref(server, installLocationHref) {
        const hashValue = this.getHostHashValueForServer(server);
        return installLocationHref + (hashValue ? `#host=` + escapeHash(hashValue) : '');
    }
    makeServerSelectErrorMessage() {
        const hostHash = (this.hostHashValue != null
            ? `host=` + escapeHash(this.hostHashValue)
            : ``);
        return [
            `Unknown server in URL hash parameter `, code(hostHash), `.`
        ];
    }
    // host-hash-specific methods
    getHostHashValueForServer(server) {
        let hostHashValue = null;
        if (server != this.serverList.defaultServer) {
            hostHashValue = server.host;
        }
        return hostHashValue;
    }
    getServerForHostHashValue(hostHashValue) {
        if (hostHashValue == null)
            return this.serverList.defaultServer;
        return this.serverList.servers.get(hostHashValue);
    }
    installHashChangeListener(cx, callback, callBackImmediately = false) {
        window.addEventListener('hashchange', () => {
            const hash = getHashFromLocation();
            const [hostHashValue, hostlessHash] = detachValueFromHash('host', hash);
            if (!cx) {
                if (hostHashValue != this.hostHashValue)
                    location.reload();
                return;
            }
            if (hostHashValue != this.getHostHashValueForServer(cx.server)) {
                location.reload();
                return;
            }
            callback(hostlessHash);
        });
        if (callBackImmediately) {
            const hash = getHashFromLocation();
            const [, hostlessHash] = detachValueFromHash('host', hash);
            callback(hostlessHash);
        }
    }
    getHostlessHash() {
        const hash = getHashFromLocation();
        const [, hostlessHash] = detachValueFromHash('host', hash);
        return hostlessHash;
    }
    pushHostlessHashInHistory(hostlessHash) {
        this.pushOrReplaceHostlessHashInHistory(hostlessHash, true);
    }
    replaceHostlessHashInHistory(hostlessHash) {
        this.pushOrReplaceHostlessHashInHistory(hostlessHash, false);
    }
    pushOrReplaceHostlessHashInHistory(hostlessHash, push = false) {
        const hash = attachValueToFrontOfHash('host', this.hostHashValue, hostlessHash);
        const fullHash = hash ? '#' + hash : '';
        if (fullHash != location.hash) {
            const url = fullHash || location.pathname + location.search;
            if (push) {
                history.pushState(history.state, '', url);
            }
            else {
                history.replaceState(history.state, '', url);
            }
        }
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

function makeCodeForm(initialValue, stashedValue, summary, textareaLabel, applyButtonLabel, isSameInput, checkInput, applyInput, runCallback, syntaxDescription, syntaxExamples) {
    const $formDetails = document.createElement('details');
    const $form = document.createElement('form');
    const $output = document.createElement('output');
    const $textarea = document.createElement('textarea');
    const $applyButton = document.createElement('button');
    const $clearButton = document.createElement('button');
    const $undoClearButton = document.createElement('button');
    $textarea.value = initialValue;
    const isEmpty = () => !$textarea.value;
    const canUndoClear = () => !!stashedValue && isEmpty();
    const reactToChanges = () => {
        const isSame = isSameInput($textarea.value);
        $output.replaceChildren();
        if (!isSame) {
            $output.append(` (with unapplied changes)`);
        }
        else if (isEmpty()) {
            $output.append(` (currently not set)`);
        }
        $applyButton.disabled = isSame;
        $clearButton.disabled = isEmpty();
        $undoClearButton.hidden = !($clearButton.hidden = canUndoClear());
        try {
            checkInput($textarea.value);
            $textarea.setCustomValidity('');
        }
        catch (ex) {
            let message = `Syntax error`;
            if (ex instanceof RangeError || ex instanceof SyntaxError)
                message = ex.message;
            $textarea.setCustomValidity(message);
        }
    };
    reactToChanges();
    {
        $formDetails.classList.add('with-code-form');
        $formDetails.open = !isEmpty();
        const $formSummary = document.createElement('summary');
        $formSummary.append(summary, $output);
        $formDetails.append($formSummary, $form);
    }
    {
        const $syntaxDetails = document.createElement('details');
        $syntaxDetails.classList.add('syntax');
        $syntaxDetails.innerHTML = syntaxDescription;
        const $examplesTitle = document.createElement('p');
        $examplesTitle.innerHTML = '<strong>Examples</strong>:';
        const $examplesList = document.createElement('dl');
        $examplesList.classList.add('examples');
        for (const [title, codeLines] of syntaxExamples) {
            const $dt = document.createElement('dt');
            $dt.append(title);
            const $dd = document.createElement('dd');
            const $code = document.createElement('code');
            $code.textContent = codeLines.join('\n');
            $dd.append($code);
            $examplesList.append($dt, $dd);
        }
        $syntaxDetails.append($examplesTitle, $examplesList);
        $form.append($syntaxDetails);
    }
    {
        $textarea.rows = 5;
        $form.append(makeDiv('major-input-group')(makeLabel()(textareaLabel, ` `, $textarea)));
    }
    {
        $applyButton.textContent = applyButtonLabel;
        $clearButton.textContent = `Clear`;
        $undoClearButton.textContent = `Restore previous`;
        $undoClearButton.type = $clearButton.type = 'button';
        $form.append(makeDiv('gridded-input-group')($applyButton, $clearButton, $undoClearButton));
    }
    $textarea.oninput = reactToChanges;
    $clearButton.onclick = () => {
        stashedValue = $textarea.value;
        $textarea.value = '';
        $undoClearButton.textContent = `Undo clear`;
        reactToChanges();
    };
    $undoClearButton.onclick = () => {
        $textarea.value = stashedValue;
        reactToChanges();
    };
    $form.onsubmit = (ev) => {
        ev.preventDefault();
        try {
            applyInput($textarea.value);
        }
        catch (ex) {
            return;
        }
        runCallback();
        reactToChanges();
    };
    return $formDetails;
}

class RadioTable {
    constructor(radioName, columns) {
        this.radioName = radioName;
        this.$table = makeElement('table')()();
        this.cellClassesList = [];
        this.nRows = 0;
        const $row = this.$table.insertRow();
        for (const [cellClasses, cellLabels] of [[[], []], ...columns]) {
            $row.append(makeElement('th')(...cellClasses)(...cellLabels));
            this.cellClassesList.push(cellClasses);
        }
    }
    addRow(provideCellContent) {
        const $radio = document.createElement('input');
        $radio.type = 'radio';
        $radio.name = this.radioName;
        $radio.id = `${this.radioName}-${this.nRows}`;
        const $row = this.$table.insertRow();
        const contentList = [[$radio], ...provideCellContent($radio)];
        for (const [i, cellContent] of contentList.entries()) {
            const cellClasses = this.cellClassesList[i] ?? [];
            let rawCellContent;
            if (typeof cellContent == 'undefined') {
                rawCellContent = [];
            }
            else if (typeof cellContent == 'boolean') {
                rawCellContent = [cellContent ? '+' : ''];
            }
            else if (typeof cellContent == 'string') {
                rawCellContent = [cellContent ? makeLink('+', cellContent) : ''];
            }
            else {
                rawCellContent = cellContent;
            }
            $row.append(makeElement('td')(...cellClasses)(...rawCellContent));
        }
        this.nRows++;
    }
}

// TODO html-escape
function term(t) {
    return `<em>&lt;${t}&gt;</em>`;
}
function property(t) {
    return `<strong><code>${t}</code></strong>`;
}
// TODO html-escape app name
const makeSyntaxDescription = (appName) => `<summary>Custom server configuration syntax</summary>
<p>Uses <a href=https://en.wikipedia.org/wiki/JSON>JSON</a> format to describe one or more custom servers.
These servers can be referred to in the <code>host</code> URL parameter and appear in the list above.
The entire custom servers input can be one of:</p>
<ul>
<li>empty when no custom servers are specified
<li>an <em>array</em> where each element is a ${term('server specification')}
<li>a single ${term('server specification')}
</ul>
<p>A ${term('server specification')} is <em>null</em> for default OSM server configuration, a <em>URL string</em> for a quick configuration, or an <em>object</em> with optional properties described below.
A <em>string</em> is equivalent to an <em>object</em> with only the ${property('web')} property set.
Possible <em>object</em> properties are:</p>
<dl>
<dt>${property('web')}
<dd><strong>required</strong>; a <em>URL string</em> or an <em>array</em> of <em>URL strings</em>; used to generate/detect links to users/notes/elements/changesets
<dt>${property('api')}
<dd>a <em>URL string</em>; used for OSM API requests; defaults to ${property('web')} property value if not specified
<dt>${property('nominatim')}
<dd>a <em>URL string</em> pointing to a <a href=https://wiki.openstreetmap.org/wiki/Nominatim>Nominatim</a> service
<dt>${property('overpass')}
<dd>a <em>URL string</em> pointing to an <a href=https://wiki.openstreetmap.org/wiki/Overpass_API>Overpass API</a> server
<dt>${property('overpassTurbo')}
<dd>a <em>URL string</em> pointing to an <a href=https://wiki.openstreetmap.org/wiki/Overpass_turbo>Overpass turbo</a> web page
<dt>${property('tiles')}
<dd>a ${term('tiles specification')}
<dt>${property('world')}
<dd>a <em>string</em>; if it's not <code>"earth"</code>, street view tools won't be shown
<dt>${property('oauth')}
<dd>an ${term('oauth specification')}
<dt>${property('note')}
<dd>a <em>URL string</em>, a <em>text string</em> or an <em>array</em> of both representing a note about the server visible on the server list
</dl>
<p>A ${term('tiles specification')} is a <em>string</em> or an <em>object</em> with optional properties described below.
A <em>string</em> value is equivalent to an <em>object</em> with only the ${property('template')} property set.
Possible <em>object</em> properties are:</p>
<dl>
<dt>${property('template')}
<dd>a <em>string</em> with template parameters like "<code>https://tile.openstreetmap.org/{z}/{x}/{y}.png</code>" or "<code>https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png</code>" to generate tile URLs
<dt>${property('attribution')}
<dd>a <em>URL string</em>, a <em>text string</em> or an <em>array</em> of both containing an <a href=https://wiki.osmfoundation.org/wiki/Licence/Attribution_Guidelines#Interactive_maps>attribution</a> displayed in the corner of the map
<dt>${property('zoom')}
<dd>a number with max zoom level; defaults to the OSM max zoom value of 19
</dl>
<p>An ${term('oauth specification')} is an <em>object</em> describing the registration of <em>${appName}</em> as an <a href=https://wiki.openstreetmap.org/wiki/OAuth#OAuth_2.0_2>OAuth 2 app</a> on this OSM server.
It can have the following properties:</p>
<dl>
<dt>${property('id')}
<dd>a <em>string</em> with the OAuth <em>client id</em>; this property is <strong>required</strong> when an ${term('oauth specification')} is present
<dt>${property('url')}
<dd>a <em>string</em> with the OAuth <em>redirect URI</em> matching the location where <em>${appName}</em> is hosted;
this property is optional, it is used to remind about the correct location that is going to receive OAuth redirects in case if <em>${appName}</em> is copied to a different location
</dl>
`;
const makeSyntaxExamples = (defaultServerListConfig) => [
    [`Local server on port 3333`, [`"http://127.0.0.1:3333/"`]],
    [`Dev server with custom tiles`, [
            `{`,
            `  "web": "https://api06.dev.openstreetmap.org/",`,
            `  "tiles": "https://tile.openstreetmap.de/{z}/{x}/{y}.png",`,
            `  "note": "dev server with German tiles"`,
            `}`
        ]],
    [`Dev server with custom tiles and different max zoom`, [
            `{`,
            `  "web": "https://api06.dev.openstreetmap.org/",`,
            `  "tiles": {`,
            `    "template": "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",`,
            `    "zoom": 20`,
            `  },`,
            `  "note": "dev server with CyclOSM tiles"`,
            `}`
        ]],
    [`Default configuration`, [JSON.stringify(defaultServerListConfig, undefined, 2)]]
];
class ServerListSection {
    constructor($section, appName, storage, server, serverList, serverSelector) {
        $section.append(makeElement('h2')()(`Servers`));
        if (!server)
            $section.append(makeDiv('notice', 'error')(...serverSelector.makeServerSelectErrorMessage(), ` Please select one of the servers below.`));
        {
            const serverTable = new RadioTable('host', [
                [[], [`host`]],
                [['capability'], [`website`]],
                [['capability'], [`own tiles`]],
                [['capability'], [`Nominatim`]],
                [['capability'], [`Overpass`]],
                [['capability'], [`Overpass turbo`]],
                [[], [`note`]],
            ]);
            for (const [availableHost, availableServer] of serverList.servers) {
                const availableServerLocation = serverSelector.getServerSelectHref(availableServer);
                let note = '';
                if (availableServer.noteText && !availableServer.noteUrl) {
                    note = availableServer.noteText;
                }
                else if (availableServer.noteUrl) {
                    note = makeLink(availableServer.noteText || `[note]`, availableServer.noteUrl);
                }
                serverTable.addRow(($radio) => {
                    $radio.checked = server == availableServer;
                    $radio.tabIndex = -1;
                    const $a = makeLink(availableHost, availableServerLocation);
                    const $label = makeElement('label')()($a);
                    $label.htmlFor = $radio.id;
                    $radio.onclick = () => $a.click();
                    return [
                        [$label],
                        availableServer.web.getUrl(''),
                        availableServer.tile.owner,
                        availableServer.nominatim?.statusUrl,
                        availableServer.overpass?.statusUrl,
                        availableServer.overpassTurbo?.url,
                        [note]
                    ];
                });
            }
            $section.append(serverTable.$table);
        }
        $section.append(makeCodeForm(getStorageString(storage, 'servers'), '', `Custom servers configuration`, `Configuration`, `Apply changes`, input => input == getStorageString(storage, 'servers'), input => {
            if (input.trim() == '')
                return;
            const configSource = JSON.parse(input);
            parseServerListSource(configSource);
        }, input => {
            setStorageString(storage, 'servers', input.trim());
        }, () => {
            location.reload();
        }, makeSyntaxDescription(appName), makeSyntaxExamples(serverList.defaultServerListConfig)));
    }
}

class AppSection {
    constructor($section, appName, oauthScope, authStorage, server, serverSelector) {
        const app = () => em(appName);
        const isSecureWebInstall = (location.protocol == 'https:' ||
            location.protocol == 'http:' && location.hostname == '127.0.0.1');
        const $clientIdInput = document.createElement('input');
        $clientIdInput.id = 'auth-app-client-id';
        $clientIdInput.type = 'text';
        $clientIdInput.value = authStorage.clientId;
        const manualCodeEntryLabel = `Manual authorization code entry`;
        const $manualCodeEntryCheckbox = document.createElement('input');
        $manualCodeEntryCheckbox.id = 'auth-app-manual-code-entry';
        $manualCodeEntryCheckbox.type = 'checkbox';
        $manualCodeEntryCheckbox.checked = authStorage.isManualCodeEntry;
        const $registrationNotice = makeDiv('notice')();
        const $useBuiltinRegistrationButton = makeElement('button')()(`Use the built-in registration`);
        const updateRegistrationNotice = () => {
            $registrationNotice.replaceChildren();
            if (!server.oauthId)
                return;
            $registrationNotice.append(`With `, makeLink(`the selected OSM server`, server.web.getUrl('')), `, `);
            if (authStorage.installUri == server.oauthUrl || !server.oauthUrl) {
                $registrationNotice.append(app(), ` has a built-in registration`);
                if (authStorage.installUri == server.oauthUrl) {
                    const href = serverSelector.addServerSelectToAppInstallLocationHref(server, server.oauthUrl);
                    $registrationNotice.append(` for `, makeLink(`its install location`, href));
                }
                if (!authStorage.clientId) {
                    $registrationNotice.append(` — `, $useBuiltinRegistrationButton);
                }
                else if (authStorage.clientId != server.oauthId) {
                    $registrationNotice.append(` but the current `, em(`client id`), ` doesn't match it`, ` — `, $useBuiltinRegistrationButton);
                }
                else {
                    $registrationNotice.append(` which matches the current `, em(`client id`), ` ✓`);
                }
            }
            else {
                const href = serverSelector.addServerSelectToAppInstallLocationHref(server, server.oauthUrl);
                $registrationNotice.append(app(), ` has a built-in registration for `, makeLink(`a different install location`, href));
            }
        };
        const $overallClientIdPresence = makeElement('span')()();
        const updateOverallClientIdPresence = () => {
            $overallClientIdPresence.replaceChildren(authStorage.clientId
                ? `you have it`
                : `you don't have it`);
        };
        updateOverallClientIdPresence();
        const onRegistrationInput = (...$inputs) => {
            for (const $input of $inputs) {
                if ($input == $clientIdInput) {
                    authStorage.clientId = $clientIdInput.value.trim();
                    updateRegistrationNotice();
                    updateOverallClientIdPresence();
                }
                else if ($input == $manualCodeEntryCheckbox) {
                    authStorage.isManualCodeEntry = $manualCodeEntryCheckbox.checked;
                }
            }
            this.onRegistrationUpdate?.();
        };
        const useBuiltinRegistration = () => {
            if (!server.oauthId)
                return;
            $clientIdInput.value = server.oauthId;
            $manualCodeEntryCheckbox.checked = false;
            onRegistrationInput($clientIdInput, $manualCodeEntryCheckbox);
        };
        $clientIdInput.oninput = () => onRegistrationInput($clientIdInput);
        $manualCodeEntryCheckbox.oninput = () => onRegistrationInput($manualCodeEntryCheckbox);
        $useBuiltinRegistrationButton.onclick = useBuiltinRegistration;
        if (server.oauthId && !authStorage.clientId &&
            (authStorage.installUri == server.oauthUrl || !server.oauthUrl)) {
            useBuiltinRegistration();
        }
        else {
            updateRegistrationNotice();
        }
        const value = (text) => {
            const $kbd = makeElement('kbd')('copy')(text);
            $kbd.onclick = () => navigator.clipboard.writeText(text);
            return $kbd;
        };
        const registrationDetails = (isOpen, redirectUri, isManualCodeEntry, summary, lead) => {
            const makeInputLink = ($input, ...content) => {
                const $anchor = document.createElement('a');
                $anchor.href = '#' + $input.id;
                $anchor.classList.add('input-link');
                $anchor.append(...content);
                $anchor.onclick = ev => {
                    ev.preventDefault();
                    $input.focus();
                };
                return $anchor;
            };
            const $details = makeElement('details')()(makeElement('summary')()(summary), ...lead, ol(li(`Go to `, makeLink(`My Settings > OAuth 2 applications > Register new application`, server.web.getUrl(`oauth2/applications/new`)), ` on `, em(server.host), `.`), li(`For `, em(`Name`), ` enter anything that would help users to identify your copy of `, app(), `, for example, `, value(`${appName} @ ${authStorage.installUri}`), `. `, `Users will see this name on the authorization granting page and in their `, makeLink(`active authorizations list`, server.web.getUrl(`oauth2/authorized_applications`)), ` after they log in here.`), li(`For `, em(`Redirect URIs`), ` enter `, mark(value(redirectUri)), `.`), li(`Uncheck `, em(`Confidential application?`)), li(`In `, em(`Permissions`), ` check:`, makePermissionsList(oauthScope)), li(`Click `, em(`Register`), `.`), li(`Copy the `, em(`Client ID`), ` to `, makeInputLink($clientIdInput, `the input below`), `.`), li(`Don't copy the `, em(`Client Secret`), `. `, `You can write it down somewhere but it's going to be useless because `, app(), ` is not a confidential app and can't keep secrets.`), li(mark(isManualCodeEntry ? `Check` : `Uncheck`), ` `, makeInputLink($manualCodeEntryCheckbox, em(manualCodeEntryLabel), ` below`), `.`)), p(`After these steps you should be able to see `, app(), ` with its client id and permissions in `, makeLink(`your client applications`, server.web.getUrl(`oauth2/applications`)), `.`));
            if (isOpen)
                $details.open = true;
            return $details;
        };
        const $overallDetails = makeElement('details')()(makeElement('summary')()(`Only required if you want logins and don't have a `, em(`client id`), ` (`, $overallClientIdPresence, `).`), p(`You have to get a `, em(`client id`), ` if you want to run your own copy of `, app(), ` and be able to perform actions requiring a login. `, `There are two possible app registration methods described below. `, `Their necessary steps are the same except for the `, mark(`marked`), ` parts.`), registrationDetails(!authStorage.clientId && isSecureWebInstall, authStorage.installUri, false, `Instructions for setting up automatic logins`, [
            p(`This method sets up the most expected login workflow: login happens after the `, em(`Authorize`), ` button is pressed.`), ` `,
            p(`This method will only work when `, app(), ` served over `, em(`https`), ` or over `, em(`http`), ` on localhost. `, ...(isSecureWebInstall
                ? [`This seems to be the case with your install.`]
                : [
                    strong(`This doesn't seem to be the case with your install.`), ` `,
                    `If you register `, app(), ` with this method, logins will likely fail after pressing the `, em(`Authorize`), ` button. `,
                    `Use the registration method with manual code entry described below or move `, app(), ` to a secure web server.`
                ]))
        ]), registrationDetails(!authStorage.clientId && !isSecureWebInstall, authStorage.manualCodeUri, true, `Instructions for setting up logins where users have to copy the authorization code manually`, [
            p(`This sets up a less user-friendly login workflow: after pressing the `, em(`Authorize`), ` an `, em(`Authorization code`), ` appears that has to be copied into the `, em(`Authorization code`), ` input below the login button on this page.`), ` `,
            p(`This setup method is required when `, app(), ` is not running on a secure web server. `, ...(!isSecureWebInstall
                ? [`This seems to be the case with your install.`]
                : [
                    strong(`This doesn't seem to be the case with your install.`), ` `,
                    `You may still use this method but the one described before gives a simpler login workflow.`
                ]))
        ]), makeElement('details')()(makeElement('summary')()(`Additional instructions for building your own copy of `, app(), ` with a registration included`), ol(li(`Register an OAuth 2 app with one of the methods described above.`), li(`Open `, code(`servers.json`), ` in `, app(), `'s source code. `, `The format of this file is described here in `, em(`Custom server configuration syntax`), `.`), li(`If you're using a custom server specified on this page, copy its configuration to `, code(`servers.json`), `.`), li(`Find the `, code(`oauth`), ` property corresponding to the server you're using or add one if it doesn't exist.`), li(`Copy the `, em(`Client ID`), ` to the `, code(`id`), ` property inside `, code(`oauth`), `.`), li(`If you're not using manual authorization code entry, copy `, app(), `'s install location (`, value(authStorage.installUri), `) to the `, code(`url`), ` property inside `, code(`oauth`), `.`), li(`Rebuild `, app(), `.`))), makeDiv('major-input-group')(makeLabel()(`Client ID `, $clientIdInput)), makeDiv('major-input-group')(makeLabel()($manualCodeEntryCheckbox, ` ` + manualCodeEntryLabel), ` (for non-https/non-secure install locations)`), $registrationNotice);
        $overallDetails.open = !authStorage.clientId;
        $section.append(makeElement('h2')()(`Register app`), $overallDetails);
    }
}
// openstreetmap-website/config/locales/en.yml en.oauth.authorize.scopes
const oauthScopeNames = {
    read_prefs: `Read user preferences`,
    write_prefs: `Modify user preferences`,
    write_diary: `Create diary entries, comments and make friends`,
    write_api: `Modify the map`,
    read_gpx: `Read private GPS traces`,
    write_gpx: `Upload GPS traces`,
    write_notes: `Modify notes`,
};
function makePermissionsList(oauthScope) {
    return ul(...oauthScope.split(' ').map(s => li(oauthScopeNames[s])));
}

class AuthError extends TypeError {
}
class LoginForms {
    constructor($container, appName, isManualCodeEntry, getRequestCodeUrl, exchangeCodeForToken) {
        this.isManualCodeEntry = isManualCodeEntry;
        this.$loginButton = makeElement('button')()(`Login`);
        this.$cancelLoginButton = makeElement('button')()(`Cancel login`);
        this.$manualCodeForm = document.createElement('form');
        this.$manualCodeButton = document.createElement('button');
        this.$manualCodeInput = document.createElement('input');
        this.$error = makeDiv('notice')();
        this.$manualCodeInput.type = 'text';
        this.$manualCodeInput.required = true;
        this.$manualCodeButton.textContent = `Login with the authorization code`;
        this.stopWaitingForAuthorization();
        this.$loginButton.onclick = async () => {
            const codeVerifier = getCodeVerifier();
            const codeChallenge = await getCodeChallenge(codeVerifier);
            const width = 600;
            const height = 600;
            const loginWindow = open(getRequestCodeUrl(codeChallenge), '_blank', `width=${width},height=${height},left=${screen.width / 2 - width / 2},top=${screen.height / 2 - height / 2}`);
            if (loginWindow == null)
                return;
            this.waitForAuthorization(loginWindow, code => exchangeCodeForToken(code, codeVerifier));
        };
        this.$cancelLoginButton.onclick = () => {
            this.stopWaitingForAuthorization();
        };
        window.addEventListener('beforeunload', () => {
            this.stopWaitingForAuthorization();
        });
        // TODO write that you may not get a confirmation page if you are already logged in - in this case logout first
        //	^ to do this, need to check if anything user-visible appears in the popup at all with auto-code registrations
        const app = () => em(appName);
        this.$manualCodeForm.append(p(`If the manual code copying method was used to register `, app(), `, copy the code into the input below.`), makeDiv('major-input-group')(makeLabel()(`Authorization code `, this.$manualCodeInput)), makeDiv('major-input-group')(this.$manualCodeButton));
        $container.append(makeDiv('major-input-group')(this.$loginButton, this.$cancelLoginButton), this.$manualCodeForm, this.$error);
    }
    respondToAppRegistration(isManualCodeEntry) {
        this.isManualCodeEntry = isManualCodeEntry;
        this.stopWaitingForAuthorization();
        this.clearError();
    }
    waitForAuthorization(loginWindow, submitCode) {
        const wrapAction = (action) => wrapFetch(this.$manualCodeButton, action, makeGetKnownErrorMessage(AuthError), this.$error, message => this.$error.textContent = message);
        if (this.isManualCodeEntry) {
            this.$manualCodeForm.onsubmit = async (ev) => {
                ev.preventDefault();
                await wrapAction(async () => {
                    await submitCode(this.$manualCodeInput.value.trim());
                    this.stopWaitingForAuthorization(); // keep the login popup on error in case user copied the code incorrectly
                });
            };
        }
        else {
            window.receiveOsmAuthCode = async (code) => {
                await wrapAction(async () => {
                    if (typeof code != 'string') {
                        throw new AuthError(`Unexpected code parameter type received from popup window`);
                    }
                    await submitCode(code);
                });
                this.stopWaitingForAuthorization();
            };
            window.receiveOsmAuthDenial = async (errorDescription) => {
                await wrapAction(async () => {
                    throw new AuthError(typeof errorDescription == 'string'
                        ? errorDescription
                        : `Unknown authorization error`);
                });
                this.stopWaitingForAuthorization();
            };
        }
        this.loginWindow = loginWindow;
        this.$loginButton.hidden = true;
        this.$cancelLoginButton.hidden = false;
        this.$manualCodeForm.hidden = !this.isManualCodeEntry;
        if (this.isManualCodeEntry) {
            this.$manualCodeInput.focus();
        }
        this.clearError();
    }
    stopWaitingForAuthorization() {
        this.$manualCodeForm.onsubmit = (ev) => ev.preventDefault();
        delete window.receiveOsmAuthCode;
        delete window.receiveOsmAuthDenial;
        this.loginWindow?.close();
        this.loginWindow = undefined;
        this.$loginButton.hidden = false;
        this.$cancelLoginButton.hidden = true;
        this.$manualCodeForm.hidden = true;
        this.$manualCodeInput.value = '';
    }
    clearError() {
        this.$error.replaceChildren();
    }
}
function getCodeVerifier() {
    const byteLength = 48; // verifier string length == byteLength * 8/6
    return encodeBase64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}
async function getCodeChallenge(codeVerifier) {
    const codeVerifierArray = new TextEncoder().encode(codeVerifier);
    const codeChallengeBuffer = await crypto.subtle.digest('SHA-256', codeVerifierArray);
    return encodeBase64url(new Uint8Array(codeChallengeBuffer));
}
function encodeBase64url(bytes) {
    const string = String.fromCharCode(...bytes);
    return btoa(string).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function isAuthErrorData(data) {
    return (data &&
        typeof data == 'object' &&
        typeof data.error_description == 'string');
}
function isAuthTokenData(data) {
    return (data &&
        typeof data == 'object' &&
        typeof data.access_token == 'string' &&
        typeof data.scope == 'string');
}
function isUserData(data) {
    return (data &&
        data.user &&
        typeof data.user == 'object' &&
        typeof data.user.id == 'number' &&
        typeof data.user.display_name == 'string' &&
        hasCorrectRoles(data.user.roles));
    function hasCorrectRoles(roles) {
        if (roles === undefined)
            return true;
        return isArrayOfStrings(roles);
    }
}
function makeLogin(scope, userData) {
    const login = {
        scope,
        uid: userData.user.id,
        username: userData.user.display_name
    };
    if (userData.user.roles)
        login.roles = userData.user.roles;
    return login;
}
class LoginSection {
    constructor($section, appName, oauthScope, loginReasons, authStorage, server, onLoginChange) {
        this.$section = $section;
        this.authStorage = authStorage;
        this.$clientIdRequired = makeDiv('notice')(`Please register the app and enter the `, em(`client id`), ` below to be able to login.`);
        this.$loginForms = makeDiv()();
        this.$loginMessage = makeDiv()();
        this.$loginTable = makeDiv()();
        const webPostUrlencodedWithPossibleAuthError = async (webPath, parameters, whenMessage) => {
            const response = await server.web.fetch.withUrlencodedBody(parameters).post(webPath);
            if (response.ok)
                return response;
            let errorData;
            try {
                errorData = await response.json();
            }
            catch { }
            if (isAuthErrorData(errorData)) {
                throw new AuthError(`Error ${whenMessage}: ${errorData.error_description}`);
            }
            else {
                throw new AuthError(`Error ${whenMessage} with unknown error format`);
            }
        };
        const fetchUserData = async (token) => {
            const userResponse = await server.api.fetch.withToken(token)(`user/details.json`);
            if (!userResponse.ok) {
                throw new AuthError(`Error while getting user details`);
            }
            let userData;
            try {
                userData = await userResponse.json();
            }
            catch { }
            if (!isUserData(userData)) {
                throw new AuthError(`Unexpected response format when getting user details`);
            }
            return userData;
        };
        const switchToToken = (token) => {
            authStorage.token = token;
            onLoginChange();
        };
        const updateInResponseToLogin = () => {
            const logins = authStorage.getLogins();
            if (logins.size == 0) {
                this.$loginMessage.replaceChildren(`No active logins. Press the button above to login. `, ...loginReasons);
                this.$loginTable.replaceChildren();
                return;
            }
            const loginTable = new RadioTable('login', [
                [['number'], [`user id`]],
                [[], [`username`]],
                [['capability'], [`profile`]],
                [['capability'], [`moderator`]],
            ]);
            loginTable.addRow(($radio) => {
                $radio.checked = !authStorage.token;
                $radio.onclick = () => {
                    switchToToken('');
                };
                const $usernameLabel = makeElement('label')()(em(`anonymous`));
                $usernameLabel.htmlFor = $radio.id;
                return [
                    [],
                    [$usernameLabel]
                ];
            });
            for (const [token, login] of logins) {
                const userHref = server.web.getUrl(`user/` + encodeURIComponent(login.username));
                const $updateButton = makeElement('button')()(`Update user info`);
                const $logoutButton = makeElement('button')()(`Logout`);
                $updateButton.onclick = () => wrapFetchForButton($updateButton, async () => {
                    const userData = await fetchUserData(token);
                    authStorage.setLogin(token, makeLogin(login.scope, userData));
                    updateInResponseToLogin();
                }, makeGetKnownErrorMessage(AuthError));
                $logoutButton.onclick = () => wrapFetchForButton($logoutButton, async () => {
                    await webPostUrlencodedWithPossibleAuthError(`oauth2/revoke`, [
                        ['token', token],
                        // ['token_type_hint','access_token']
                        ['client_id', authStorage.clientId]
                    ], `while revoking a token`);
                    authStorage.deleteLogin(token);
                    if (authStorage.token == token) {
                        switchToToken('');
                    }
                    updateInResponseToLogin();
                }, makeGetKnownErrorMessage(AuthError));
                loginTable.addRow(($radio) => {
                    $radio.checked = authStorage.token == token;
                    $radio.onclick = () => {
                        switchToToken(token);
                    };
                    const $uidLabel = makeElement('label')()(String(login.uid));
                    const $usernameLabel = makeElement('label')()(login.username);
                    $uidLabel.htmlFor = $usernameLabel.htmlFor = $radio.id;
                    return [
                        [$uidLabel],
                        [$usernameLabel],
                        userHref,
                        login.roles?.includes('moderator'),
                        [$updateButton],
                        [$logoutButton],
                    ];
                });
            }
            this.$loginMessage.replaceChildren(`You can login again and have several different active logins. Use the table below to switch between them.`);
            this.$loginTable.replaceChildren(loginTable.$table);
        };
        this.loginForms = new LoginForms(this.$loginForms, appName, authStorage.isManualCodeEntry, (codeChallenge) => {
            return server.web.getUrl('oauth2/authorize') + '?' + [
                ['client_id', authStorage.clientId],
                ['redirect_uri', authStorage.redirectUri],
                ['scope', oauthScope],
                ['response_type', 'code'],
                ['code_challenge', codeChallenge],
                ['code_challenge_method', 'S256']
            ].map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
        }, async (code, codeVerifier) => {
            const tokenResponse = await webPostUrlencodedWithPossibleAuthError(`oauth2/token`, [
                ['client_id', authStorage.clientId],
                ['redirect_uri', authStorage.redirectUri],
                ['grant_type', 'authorization_code'],
                ['code', code],
                ['code_verifier', codeVerifier]
            ], `while getting a token`);
            let tokenData;
            try {
                tokenData = await tokenResponse.json();
            }
            catch { }
            if (!isAuthTokenData(tokenData)) {
                throw new AuthError(`Unexpected response format when getting a token`);
            }
            const userData = await fetchUserData(tokenData.access_token);
            authStorage.setLogin(tokenData.access_token, makeLogin(tokenData.scope, userData));
            switchToToken(tokenData.access_token);
            updateInResponseToLogin();
        });
        this.updateVisibility();
        updateInResponseToLogin();
        $section.append(makeElement('h2')()(`Logins`), this.$clientIdRequired, this.$loginForms, this.$loginMessage, this.$loginTable);
    }
    respondToAppRegistration() {
        this.loginForms.respondToAppRegistration(this.authStorage.isManualCodeEntry);
        this.updateVisibility();
    }
    focusOnLogin() {
        this.$section.scrollIntoView();
        if (!this.$loginForms.hidden && !this.loginForms.$loginButton.hidden) {
            this.loginForms.$loginButton.focus();
        }
    }
    updateVisibility() {
        const canLogin = !!this.authStorage.clientId;
        this.$clientIdRequired.hidden = canLogin;
        this.$loginForms.hidden = !canLogin;
        this.$loginMessage.hidden = !canLogin;
        this.$loginTable.hidden = !canLogin;
    }
}

function isAuthOpener(o) {
    return (o && typeof o == 'object' &&
        typeof o.receiveOsmAuthCode == 'function' &&
        typeof o.receiveOsmAuthDenial == 'function');
}
function checkAuthRedirectForInstallUri(appName, installUri) {
    const app = () => em(appName);
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    if (code == null && error == null) {
        return false;
    }
    if (!isAuthOpener(window.opener)) {
        document.body.append(makeDiv('notice')(`This is the location of authentication redirect for `, app(), `. `, `It is expected to be opened in a popup window when performing a login. `, `Instead it is opened outside of a popup and cannot function properly. `, `If you want to continue using `, app(), `, please open `, makeLink(`this link`, installUri), `.`));
    }
    else if (code != null) {
        window.opener.receiveOsmAuthCode(code);
    }
    else if (error != null) {
        window.opener.receiveOsmAuthDenial(errorDescription ?? error);
    }
    return true;
}

const installUri = `${location.protocol}//${location.host}${location.pathname}`;
function checkAuthRedirect(appName) {
    return checkAuthRedirectForInstallUri(appName, installUri);
}
class Net {
    constructor(appName, oauthScope, loginReasons, serverListConfig, storage, makeServerSelector, onLoginChange) {
        this.$sections = [];
        const serverListConfigSources = [serverListConfig];
        try {
            const customServerListConfig = storage.getItem('servers');
            if (customServerListConfig != null) {
                serverListConfigSources.push(JSON.parse(customServerListConfig));
            }
        }
        catch { }
        this.serverList = new ServerList(...serverListConfigSources);
        this.serverSelector = makeServerSelector(this.serverList);
        const server = this.serverSelector.selectServer();
        this.$serverListSection = makeElement('section')()();
        new ServerListSection(this.$serverListSection, appName, storage, server, this.serverList, this.serverSelector);
        if (server) {
            const authStorage = new AuthStorage(storage, server.host, installUri);
            this.cx = new Connection(server, authStorage);
            this.$appSection = makeElement('section')()();
            this.$loginSection = makeElement('section')()();
            const appSection = new AppSection(this.$appSection, appName, oauthScope, authStorage, server, this.serverSelector);
            const loginSection = new LoginSection(this.$loginSection, appName, oauthScope, loginReasons, authStorage, server, onLoginChange);
            appSection.onRegistrationUpdate = () => loginSection.respondToAppRegistration();
            this.$sections.push(this.$loginSection, this.$appSection);
            this.loginSection = loginSection;
        }
        this.$sections.push(this.$serverListSection);
    }
    focusOnLogin() {
        this.loginSection?.focusOnLogin(); // TODO move to connection?
    }
}

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

class WorkerBroadcastChannel {
    constructor(host) {
        this.broadcastChannel = new BroadcastChannel(`OsmChangesetViewer[${host}]`);
    }
}
class WorkerBroadcastReceiver extends WorkerBroadcastChannel {
    set onmessage(listener) {
        this.broadcastChannel.onmessage = listener;
    }
}

class DragListener {
    constructor($target) {
        this.$target = $target;
        this.cursorHovering = 'grab';
        this.cursorGrabbing = 'grabbing';
    }
    install() {
        this.$target.style.touchAction = 'none';
        this.$target.style.cursor = this.cursorHovering;
        this.$target.onpointerdown = ev => {
            if (this.grab)
                return;
            this.grab = this.beginDrag(ev);
            if (!this.grab)
                return;
            this.$target.setPointerCapture(ev.pointerId);
            this.$target.style.cursor = this.cursorGrabbing;
            this.$target.focus();
            ev.preventDefault();
        };
        this.$target.onpointermove = ev => {
            if (!this.grab || this.grab.pointerId != ev.pointerId)
                return;
            this.doDrag(ev, this.grab);
            ev.preventDefault();
        };
        this.$target.onpointerup = ev => {
            if (!this.grab || this.grab.pointerId != ev.pointerId)
                return;
            this.applyDrag(ev, this.grab);
            this.endDrag(ev, this.grab);
            this.grab = undefined;
            this.$target.style.cursor = this.cursorHovering;
            ev.preventDefault();
        };
        this.$target.onpointercancel = ev => {
            if (!this.grab || this.grab.pointerId != ev.pointerId)
                return;
            this.endDrag(ev, this.grab);
            this.grab = undefined;
            this.$target.style.cursor = this.cursorHovering;
            ev.preventDefault();
        };
    }
    doDrag(ev, grab) { }
    applyDrag(ev, grab) { }
    endDrag(ev, grab) { }
}

class TabDragListener extends DragListener {
    constructor($gridHead, gridHeadCells, $tab, iActive, shiftTabCallback) {
        super($tab);
        this.$gridHead = $gridHead;
        this.gridHeadCells = gridHeadCells;
        this.iActive = iActive;
        this.shiftTabCallback = shiftTabCallback;
    }
    install() {
        const activeCells = this.gridHeadCells[this.iActive];
        activeCells.$tabCell.ontransitionend =
            activeCells.$cardCell.ontransitionend =
                activeCells.$selectorCell.ontransitionend = ev => {
                    const $cell = ev.currentTarget;
                    if (!($cell instanceof HTMLElement))
                        return;
                    $cell.classList.remove('settling');
                };
        super.install();
    }
    beginDrag(ev) {
        if (ev.target instanceof Element && ev.target.closest('button'))
            return;
        this.toggleCellClass('grabbed', true);
        this.$gridHead.classList.add('with-grabbed-tab');
        return {
            pointerId: ev.pointerId,
            startX: ev.clientX,
            iShiftTo: this.iActive,
            relativeShiftX: 0
        };
    }
    doDrag(ev, grab) {
        const cellStartX = this.gridHeadCells[this.iActive].$tabCell.offsetLeft;
        const minOffsetX = this.gridHeadCells[0].$tabCell.offsetLeft - cellStartX;
        const maxOffsetX = this.gridHeadCells[this.gridHeadCells.length - 1].$tabCell.offsetLeft - cellStartX;
        const offsetX = Math.max(minOffsetX, Math.min(maxOffsetX, ev.clientX - grab.startX));
        this.translate(offsetX);
        const cellOffsetX = cellStartX + offsetX;
        let iShiftTo = 0;
        for (; iShiftTo < this.gridHeadCells.length; iShiftTo++) {
            const $shiftToCell = this.gridHeadCells[iShiftTo].$tabCell;
            grab.relativeShiftX = cellOffsetX - $shiftToCell.offsetLeft;
            if (cellOffsetX < $shiftToCell.offsetLeft + $shiftToCell.offsetWidth / 2) {
                break;
            }
        }
        for (let iShuffle = 0; iShuffle < this.gridHeadCells.length; iShuffle++) {
            if (iShuffle == this.iActive)
                continue;
            let shuffleX = 0;
            if (iShuffle >= iShiftTo && iShuffle < this.iActive) {
                shuffleX = this.gridHeadCells[iShuffle + 1].$tabCell.offsetLeft - this.gridHeadCells[iShuffle].$tabCell.offsetLeft;
            }
            if (iShuffle > this.iActive && iShuffle <= iShiftTo) {
                shuffleX = this.gridHeadCells[iShuffle - 1].$tabCell.offsetLeft - this.gridHeadCells[iShuffle].$tabCell.offsetLeft;
            }
            this.translate(shuffleX, iShuffle);
        }
        grab.iShiftTo = iShiftTo;
    }
    applyDrag(ev, grab) {
        if (grab.iShiftTo != this.iActive)
            this.shiftTabCallback(grab.iShiftTo);
    }
    endDrag(ev, grab) {
        for (const i of this.gridHeadCells.keys()) {
            this.translate(0, i);
        }
        this.toggleCellClass('grabbed', false);
        this.$gridHead.classList.remove('with-grabbed-tab');
        if (!grab.relativeShiftX)
            return;
        requestAnimationFrame(() => {
            this.translate(grab.relativeShiftX);
            requestAnimationFrame(() => {
                this.toggleCellClass('settling', true);
                this.translate(0);
            });
        });
    }
    translate(x, i = this.iActive) {
        const { $tabCell, $cardCell, $selectorCell } = this.gridHeadCells[i];
        if (x) {
            $tabCell.style.translate = `${x}px`;
            $cardCell.style.translate = `${x}px`;
            $selectorCell.style.translate = `${x}px`;
        }
        else {
            $tabCell.style.removeProperty('translate');
            $cardCell.style.removeProperty('translate');
            $selectorCell.style.removeProperty('translate');
        }
    }
    toggleCellClass(className, on) {
        const activeCells = this.gridHeadCells[this.iActive];
        activeCells.$tabCell.classList.toggle(className, on);
        activeCells.$cardCell.classList.toggle(className, on);
        activeCells.$selectorCell.classList.toggle(className, on);
    }
}

class HuePickerDragListener extends DragListener {
    constructor($target, $stripe, changeListener) {
        super($target);
        this.$stripe = $stripe;
        this.changeListener = changeListener;
    }
    beginDrag(ev) {
        return {
            pointerId: ev.pointerId,
            startX: ev.clientX,
            startValue: readValueFromString(this.$target.dataset.value ?? '')
        };
    }
    doDrag(ev, grab) {
        const newValue = this.getNewValue(grab, ev.clientX);
        slideStripe(this.$stripe, newValue);
    }
    endDrag(ev, grab) {
        const newValue = this.getNewValue(grab, ev.clientX);
        this.$target.dataset.value = String(newValue);
        slideStripe(this.$stripe, newValue);
        this.changeListener(newValue);
    }
    getNewValue(grab, pointerX) {
        return limitValue(grab.startValue + (grab.startX - pointerX) * 360 / this.$target.clientWidth);
    }
}
function makeHuePicker(changeListener) {
    const $stripe = makeElement('span')('hue-picker-stripe')();
    const stripeStops = [];
    for (let hue = 0; hue <= 720; hue += 30) {
        stripeStops.push(`hsl(${hue - 180} 100% 50%) ${100 * hue / 720}%`);
    }
    $stripe.style.background = `linear-gradient(to right, ${stripeStops.join(', ')})`;
    const $picker = makeDiv('hue-picker')($stripe);
    $picker.tabIndex = 0;
    $picker.dataset.value = String(0);
    $picker.onkeydown = ev => {
        const value = readValueFromString($picker.dataset.value ?? '');
        let newValue;
        if (ev.key == 'ArrowLeft') {
            newValue = mod(value - 10, 360);
        }
        else if (ev.key == 'ArrowRight') {
            newValue = mod(value + 10, 360);
        }
        if (newValue != null) {
            $picker.dataset.value = String(newValue);
            slideStripe($stripe, newValue);
            ev.stopPropagation();
            ev.preventDefault();
            changeListener(newValue);
        }
    };
    new HuePickerDragListener($picker, $stripe, changeListener).install();
    return $picker;
}
function updateHuePicker($picker, value) {
    $picker.dataset.value = String(value);
    const $stripe = $picker.querySelector(':scope > .hue-picker-stripe');
    if ($stripe instanceof HTMLElement) {
        slideStripe($stripe, value);
    }
}
function slideStripe($stripe, value) {
    $stripe.style.left = `${-value * 100 / 360}%`;
}
function readValueFromString(s) {
    const v = Number(s);
    if (!Number.isFinite(v))
        return 0;
    return limitValue(v);
}
function limitValue(v) {
    return mod(Math.round(v), 360);
}
function mod(n, d) {
    return (n % d + d) % d;
}

const cyrillicLetters = 'АВСЕНКМОРТХасеорху'; // can also add non-Russian letters like 'i' 
function decorateUserName(name) {
    const chunks = [];
    const re = new RegExp(`(.*?\\p{Script=Latn})([${cyrillicLetters}]+)(?=\\p{Script=Latn})`, 'uy');
    let idx = 0;
    while (true) {
        idx = re.lastIndex;
        const match = re.exec(name);
        if (!match)
            break;
        const [, beforeInclusion, inclusion] = match;
        chunks.push([beforeInclusion]);
        chunks.push([inclusion, { belongsTo: 'Cyrl', surroundedBy: 'Latn' }]);
    }
    chunks.push([name.slice(idx)]);
    return chunks;
}

const merkaartorIcon = "data:image/png;base64," +
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAADSE" +
    "lEQVQ4ywXBW0xbdQDA4V/Praen9zrKRQrtoDABYYOI84ZRhy5Z" +
    "4maiMxkxPviq8c3om0/GV5+mZiZuZm9bfNmIYYkJMTFZhpaxZQ" +
    "wcZC1QSinrhdL29Fz+fp/nxuVZsZxZomWCqmnki00Wl5ocNSxm" +
    "puOk+rvZzO6BcPEbPlI9gvKhS1A3iXelUP59sIfVtsjtmtx7aF" +
    "E9hHPvpBgZjjM5nkTVo9y9t8LKgyfc+StLy4SRAQ/pPhWHAooi" +
    "22TW66znPOgafPP1KV4YO81WdpXdkslecZ2QX2JycgKf7yGm6X" +
    "DzjyLHIoJw2EQJhwyyu1CtC8IB+OFKhrad4c1XB2gcLlMoVsju" +
    "QsuERhtiQZga1VheEwykZKSQH/bLYLah0YL9Knx4toe5i2/xya" +
    "X36O324zhgC7AsmBo1ODksIUsWjzYcpLarY9sQDcH0i16ChkS1" +
    "oeMKmVJVoSOm0RGDoT4VQ4d60yVouCQ6oXjQRqnWZTweiARhdN" +
    "DPmdc7uDG/wfNLG9xeWEJ2K1gOlEs2QoBHmKiqTk9cYrMAirBr" +
    "dEQhYEAooKDKFl99PoushZkaexevEeba1d8YTA+Ry20zNiBRqb" +
    "Xo7ZTYe3aEJMsKpSr0d6tEI358RoCt7QI//vonT7dKXPnlOgiL" +
    "y9dWiMcUBAqq6sGnq4SDGkrL0kCAEBKO43BUr3D19x36e48xv5" +
    "ChXm+yXxZc+mCcjtgB4ZCOZbXQVPDgIOGRCQVgeMCPpvkwzTbJ" +
    "LocL517CcQW1I4HqDTD79gRHppfvf8oi8NJuN5EVBUnVDFL9nS" +
    "QSx3m8WUXWE0yMRLh1a57xIY3tPZiaSOPYFhs5k2ze5ruf99gp" +
    "BVBkF2UwGWP6yzPIikrm/mNW17aIR6Gzw0C4LaIh6E88h6wG2d" +
    "4poXvBsuHmnQrJXgP5i89Ofytci918nkgsQbIvwtNcme6uGCuP" +
    "imTzAtduospHdHeFaDQOuXh+muO9XvKFCkq5ahMyXFZW89QaOh" +
    "9fOIUQMk/W/uH+msv5syd47eVRkqkUh7UDZmbeQFF0hLDZKVxH" +
    "elauUq9VWFjcIBz0oihe0uk0txdrzH30Cp/Ovc+J0ZPIqo+/76" +
    "6i60F0X5DN/5YJ+SX+B9iyZV21U+bvAAAAAElFTkSuQmCC";
const editorData = [
    [
        'ArcGIS Editor',
        'https://wiki.openstreetmap.org/wiki/ArcGIS_Editor_for_OSM',
        { type: 'text', name: 'ArcGIS' },
    ], [
        'autoAWS',
        'https://wiki.openstreetmap.org/wiki/AutoAWS',
        { type: 'text', name: 'autoAWS' },
    ], [
        'Every Door',
        'https://wiki.openstreetmap.org/wiki/Every_Door',
        { type: 'svg', id: 'everydoor' },
    ], [
        'Go Map!!',
        'https://wiki.openstreetmap.org/wiki/Go_Map!!',
        { type: 'svg', id: 'gomap' },
    ], [
        'https://osm.wikidata.link/',
        'https://wiki.openstreetmap.org/wiki/OSM_%E2%86%94_Wikidata_matcher',
        { type: 'text', name: 'OSM↔Wikidata' },
    ], [
        'https_all_the_things',
        'https://wiki.openstreetmap.org/wiki/Automated_Edits/b-jazz-bot',
        { type: 'text', name: 'https_all_the_things' },
    ], [
        'iD',
        'https://wiki.openstreetmap.org/wiki/ID',
        { type: 'svg', id: 'id' },
    ], [
        'JOSM',
        'https://wiki.openstreetmap.org/wiki/JOSM',
        { type: 'svg', id: 'josm' },
    ], [
        'Level0',
        'https://wiki.openstreetmap.org/wiki/Level0',
        { type: 'text', name: 'Level0' },
    ], [
        'Map builder',
        'https://www.bing.com/mapbuilder/',
        { type: 'svg', id: 'mapbuilder' },
    ], [
        'MapComplete',
        'https://wiki.openstreetmap.org/wiki/MapComplete',
        { type: 'svg', id: 'mapcomplete' },
    ], [
        'MapRoulette',
        'https://wiki.openstreetmap.org/wiki/MapRoulette',
        { type: 'svg', id: 'maproulette' },
    ], [
        'MAPS.ME',
        'https://wiki.openstreetmap.org/wiki/MAPS.ME',
        { type: 'svg', id: 'mapsme' },
        /^\s*#mapsme\s*$/m
    ], [
        'Merkaartor',
        'https://wiki.openstreetmap.org/wiki/Merkaartor',
        { type: 'data', data: merkaartorIcon },
    ], [
        'Organic Maps',
        'https://wiki.openstreetmap.org/wiki/Organic_Maps',
        { type: 'svg', id: 'organicmaps' },
        /^\s*#organicmaps\s*$/m
    ], [
        'osm-bulk-upload/upload.py',
        'https://wiki.openstreetmap.org/wiki/Upload.py',
        { type: 'text', name: 'upload.py' },
    ], [
        'osm-relatify',
        'https://wiki.openstreetmap.org/wiki/Relatify',
        { type: 'text', name: 'Relatify' },
    ], [
        'OsmAnd',
        'https://wiki.openstreetmap.org/wiki/OsmAnd',
        { type: 'svg', id: 'osmand' },
    ], [
        'osmapi/',
        'https://wiki.openstreetmap.org/wiki/Osmapi_(Python_library)',
        { type: 'text', name: 'osmapi' },
    ], [
        'OsmHydrant',
        'https://wiki.openstreetmap.org/wiki/OsmHydrant',
        { type: 'text', name: 'OsmHydrant' },
    ], [
        'OsmInEdit',
        'https://wiki.openstreetmap.org/wiki/OsmInEdit',
        { type: 'text', name: 'OsmInEdit' },
    ], [
        'Osmose Editor',
        'https://wiki.openstreetmap.org/wiki/Osmose#Osmose_integrated_tags_editor',
        { type: 'svg', id: 'osmose' },
    ], [
        'osmtools',
        'https://wiki.openstreetmap.org/wiki/Revert_scripts',
        { type: 'text', name: 'osmtools' },
    ], [
        'Potlatch',
        'https://wiki.openstreetmap.org/wiki/Potlatch',
        { type: 'svg', id: 'potlatch' },
    ], [
        'RapiD',
        'https://wiki.openstreetmap.org/wiki/Rapid',
        { type: 'svg', id: 'rapid' },
    ], [
        'Redaction bot',
        'https://wiki.openstreetmap.org/wiki/OSMF_Redaction_Bot',
        { type: 'text', name: 'Redaction bot' }
    ], [
        'StreetComplete',
        'https://wiki.openstreetmap.org/wiki/StreetComplete',
        { type: 'svg', id: 'streetcomplete' },
        /(?:^Unable to answer.*?|\n\n)via (StreetComplete\s+.*?):?$/m
    ], [
        'Vespucci',
        'https://wiki.openstreetmap.org/wiki/Vespucci',
        { type: 'svg', id: 'vespucci' },
    ],
];

function getItemDescriptorSelector({ type, id, order }) {
    return `.item[data-type="${type}"][data-id="${id}"]` + (order
        ? `[data-order="${order}"]`
        : `:not([data-order])`);
}
function getBroadItemDescriptorSelector({ type, id }) {
    let typeSelector = `[data-type="${type}"]`;
    if (type == 'changeset' || type == 'changesetClose' || type == 'changesetComment') {
        typeSelector = `[data-type^="changeset"]`;
    }
    else if (type == 'note' || type == 'noteComment') {
        typeSelector = `[data-type^="note"]`;
    }
    return `.item${typeSelector}[data-id="${id}"]`;
}
function isItem($item) {
    return $item instanceof HTMLElement && $item.classList.contains('item');
}
function isGreaterElementSequencePoint(a, b) {
    if (a.timestamp != b.timestamp)
        return a.timestamp > b.timestamp;
    const aRank = getElementTypeRank(a.type);
    const bRank = getElementTypeRank(b.type);
    if (aRank != bRank)
        return aRank > bRank;
    if (a.id != b.id)
        return (a.id ?? 0) > (b.id ?? 0);
    return (a.order ?? 0) > (b.order ?? 0);
}
function isEqualItemDescriptor(a, b) {
    return a.type == b.type && a.id == b.id && a.order == b.order;
}
function getElementTypeRank(type) {
    switch (type) {
        case 'user':
            return 1;
        case 'changeset':
            return 2;
        case 'changesetClose':
            return 3;
        case 'note':
            return 4;
        case 'changesetComment':
            return 5;
        case 'noteComment':
            return 6;
    }
    return +Infinity; // rank of separators
}
function getBatchItemSequencePoint({ type, item }) {
    let date;
    let id;
    let order;
    if (type == 'user') {
        date = item.createdAt;
        id = item.id;
    }
    else if (type == 'changeset' || type == 'changesetClose') {
        date = item.createdAt;
        if (type == 'changesetClose' && item.closedAt) {
            date = item.closedAt;
        }
        id = item.id;
    }
    else if (type == 'note') {
        date = item.createdAt;
        id = item.id;
    }
    else if (type == 'changesetComment' || type == 'noteComment') {
        date = item.createdAt;
        id = item.itemId;
        order = item.order;
    }
    else {
        return null;
    }
    const timestamp = date.getTime();
    if (order) {
        return { timestamp, type, id, order };
    }
    else {
        return { timestamp, type, id };
    }
}
function readItemDescriptor($item) {
    const type = $item.dataset.type;
    if (!type)
        return null;
    const id = Number($item.dataset.id);
    if (!Number.isInteger(id))
        return null;
    const orderString = $item.dataset.order;
    if (orderString != null) {
        const order = Number(orderString);
        if (!Number.isInteger(order))
            return null;
        if (order != 0)
            return { type, id, order };
    }
    return { type, id };
}
function getCommentItemDescriptor(descriptor, order) {
    const id = descriptor.id;
    let type;
    if (descriptor.type == 'changeset' || descriptor.type == 'changesetClose' || descriptor.type == 'changesetComment') {
        type = 'changesetComment';
    }
    else if (descriptor.type == 'note' || descriptor.type == 'noteComment') {
        type = 'noteComment';
    }
    else {
        return null;
    }
    if (order != 0) {
        return { type, id, order };
    }
    else {
        return { type, id };
    }
}
function getMainItemDescriptor(descriptor) {
    const id = descriptor.id;
    let type;
    if (descriptor.type == 'changeset' || descriptor.type == 'changesetClose' || descriptor.type == 'changesetComment') {
        type = 'changeset';
    }
    else if (descriptor.type == 'note' || descriptor.type == 'noteComment') {
        type = 'note';
    }
    else {
        return null;
    }
    return { type, id };
}
function readElementSequencePoint($e) {
    const timestamp = Number($e.dataset.timestamp);
    if (timestamp == null)
        return null;
    const type = $e.dataset.type;
    if (!type)
        return null;
    const idString = $e.dataset.id;
    if (idString == null)
        return { timestamp, type };
    const id = Number(idString);
    if (!Number.isInteger(id))
        return null;
    const orderString = $e.dataset.order;
    if (orderString == null)
        return { timestamp, type, id };
    const order = Number(orderString);
    if (!Number.isInteger(order))
        return null;
    if (order == 0)
        return { timestamp, type, id };
    return { timestamp, type, id, order };
}
function readItemSequencePoint($e) {
    const sequencePoint = readElementSequencePoint($e);
    if (!sequencePoint || sequencePoint.id == null)
        return null;
    return sequencePoint;
}
function writeElementSequencePoint($e, info) {
    $e.dataset.timestamp = String(info.timestamp);
    $e.dataset.type = info.type;
    if (info.id) {
        $e.dataset.id = String(info.id);
    }
    else {
        delete $e.dataset.id;
    }
    if (info.order) {
        $e.dataset.order = String(info.order);
    }
    else {
        delete $e.dataset.order;
    }
}
function writeSeparatorSequencePoint($e, date) {
    writeElementSequencePoint($e, {
        timestamp: getLastTimestampOfMonth(date),
        type: 'separator',
    });
}
function getLastTimestampOfMonth(date) {
    let monthIndex = date.getUTCMonth();
    let year = date.getUTCFullYear();
    monthIndex++;
    if (monthIndex >= 12) {
        monthIndex = 0;
        year++;
    }
    return Date.UTC(year, monthIndex) - 1;
}
function readCollapsedItemCommentPieceText($piece) {
    return $piece.dataset.fullComment ?? $piece.textContent;
}
function writeCollapsedItemCommentPieceText($piece, text, shortText) {
    const maxLength = 200;
    const maxLengthThreshold = maxLength + 3;
    if (shortText != null) {
        $piece.dataset.fullComment = text;
        if (shortText.length > maxLengthThreshold) {
            $piece.textContent = '...' + shortText.substring(0, maxLength) + '...';
        }
        else {
            $piece.textContent = '...' + shortText;
        }
    }
    else {
        if (text.length > maxLengthThreshold) {
            $piece.dataset.fullComment = text;
            $piece.textContent = text.substring(0, maxLength) + '...';
        }
        else {
            delete $piece.dataset.fullComment;
            $piece.textContent = text;
        }
    }
}
function writeHueAttributes(colorizer, $e, uid) {
    if (uid != null) {
        $e.dataset.hueUid = String(uid);
        $e.style.setProperty('--hue', String(colorizer.getHueForUid(uid)));
        $e.style.setProperty('--saturation-factor', '1');
    }
    else {
        $e.dataset.hueUid = '';
        $e.style.setProperty('--hue', '0');
        $e.style.setProperty('--saturation-factor', '0');
    }
}

const pad = (n) => ('0' + n).slice(-2);
function toIsoYearMonthString(date, separator = '-') {
    return (date.getUTCFullYear() + separator +
        pad(date.getUTCMonth() + 1));
}
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
function makeDateOutput(date) {
    const isoDateString = toIsoDateString(date);
    const isoTimeString = toIsoTimeString(date);
    const $time = makeElement('time')()(makeElement('span')('date')(isoDateString), makeElement('span')('gap')(' '), makeElement('span')('time')(isoTimeString));
    $time.dateTime = toIsoString(date);
    $time.title = `${isoDateString} ${isoTimeString} UTC`;
    return $time;
}
function installRelativeTimeListeners($root) {
    $root.addEventListener('mouseover', listener);
    $root.addEventListener('focusin', listener);
}
const units = [
    [1, 'second'],
    [60, 'minute'],
    [60 * 60, 'hour'],
    [60 * 60 * 24, 'day'],
    [60 * 60 * 24 * 7, 'week'],
    [60 * 60 * 24 * 30, 'month'],
    [60 * 60 * 24 * 365, 'year'],
];
const relativeTimeFormat = new Intl.RelativeTimeFormat('en');
function listener(ev) {
    if (!(ev.target instanceof Element))
        return;
    let $time;
    if (ev.target instanceof HTMLTimeElement) {
        $time = ev.target;
    }
    else if (ev.target.parentElement instanceof HTMLTimeElement) { // target is <span> inside <time>
        $time = ev.target.parentElement;
    }
    else {
        return;
    }
    if (!$time.dateTime)
        return;
    const readableTime = $time.dateTime.replace('T', ' ').replace('Z', ' UTC');
    const t1ms = Date.parse($time.dateTime);
    const t2ms = Date.now();
    let relativeTime = 'just now';
    for (const [duration, name] of units) {
        if (t2ms - t1ms < duration * 1500)
            break;
        const timeDifferenceInUnits = Math.round((t1ms - t2ms) / (duration * 1000));
        relativeTime = relativeTimeFormat.format(timeDifferenceInUnits, name);
    }
    $time.title = `${readableTime}, ${relativeTime}`;
}

function makeDisclosureButton(isExpanded, label) {
    const $disclosure = makeElement('button')('disclosure')();
    $disclosure.title = (isExpanded ? `Collapse` : `Expand`) + ` ` + label;
    setDisclosureButtonState($disclosure, isExpanded);
    const r = 5.5;
    const s = 3.5;
    $disclosure.innerHTML = makeCenteredSvg(r, `<line x1="${-s}" x2="${s}" />` +
        `<line y1="${-s}" y2="${s}" class="vertical-stroke" />`, `stroke="currentColor"`);
    return $disclosure;
}
function getDisclosureButtonState($disclosure) {
    return $disclosure.getAttribute('aria-expanded') == 'true';
}
function setDisclosureButtonState($disclosure, isExpanded) {
    $disclosure.setAttribute('aria-expanded', String(isExpanded));
    if (isExpanded) {
        $disclosure.title = $disclosure.title.replace(`Expand`, `Collapse`);
    }
    else {
        $disclosure.title = $disclosure.title.replace(`Collapse`, `Expand`);
    }
}
function makeCenteredSvg(r, content, attrs) {
    return `<svg width="${2 * r}" height="${2 * r}" viewBox="${-r} ${-r} ${2 * r} ${2 * r}"${attrs ? ' ' + attrs : ''}>${content}</svg>`;
}

const e$2 = makeEscapeTag(encodeURIComponent);
function getItemCheckbox($item) {
    const $checkbox = $item.querySelector('.icon input');
    if ($checkbox instanceof HTMLInputElement) {
        return $checkbox;
    }
}
function getItemDisclosureButton($item) {
    const $button = $item.querySelector('button.disclosure');
    if ($button instanceof HTMLButtonElement) {
        return $button;
    }
}
function makeItemShell(colorizer, { type, item }, isExpanded, usernames) {
    let id;
    const $icon = makeElement('span')('icon')();
    let $senderIcon;
    const $balloon = makeElement('span')('balloon')(makeDisclosureButton(isExpanded, `item info`), ` `, makeElement('span')('flow')());
    const $item = makeElement('span')('item')();
    if (type == 'user') {
        $item.classList.add('user');
        id = item.id;
        writeNewUserIcon($icon, id);
        writeHueAttributes(colorizer, $icon, item.id);
        writeHueAttributes(colorizer, $balloon, item.id);
    }
    else if (type == 'changeset' || type == 'changesetClose') {
        $item.classList.add('changeset');
        if (type == 'changesetClose')
            $item.classList.add('closed');
        id = item.id;
        let size = 0;
        if (item.changes.count > 0) {
            const cappedChangesCount = Math.min(9999, item.changes.count);
            size = 1 + Math.floor(Math.log10(cappedChangesCount));
        }
        else {
            if (type != 'changesetClose') {
                $item.classList.add('empty');
            }
        }
        $icon.dataset.size = String(size);
        writeChangesetIcon($icon, id, type == 'changesetClose', item.changes.count == 0, size);
        writeHueAttributes(colorizer, $icon, item.uid);
        writeHueAttributes(colorizer, $balloon, item.uid);
    }
    else if (type == 'note') {
        $item.classList.add('note');
        id = item.id;
        writeNoteIcon($icon, id);
        writeHueAttributes(colorizer, $icon, item.uid);
        writeHueAttributes(colorizer, $balloon, item.uid);
    }
    else if (type == 'changesetComment' || type == 'noteComment') {
        $item.classList.add('comment');
        if (!item.text)
            $item.classList.add('mute');
        id = item.itemId;
        const $button = makeElement('button')('ref')();
        $icon.append($button);
        let commentIconSvg;
        if (type == 'noteComment') {
            $item.classList.add('for-note');
            if (item.action == 'commented') {
                $item.classList.add('passive');
            }
            else {
                $item.classList.add(item.action);
            }
            $button.title = `${item.action} note ${id}`;
            commentIconSvg = getSvgOfCommentIcon('note', item.action);
        }
        else {
            $item.classList.add('for-changeset');
            $item.classList.add('passive');
            $button.title = `comment for changeset ${id}`;
            commentIconSvg = getSvgOfCommentIcon('changeset');
        }
        writeHueAttributes(colorizer, $icon, item.itemUid);
        writeHueAttributes(colorizer, $balloon, item.uid);
        if (item.uid == item.itemUid) {
            $button.innerHTML = commentIconSvg;
            $icon.insertAdjacentHTML('beforeend', (item.text
                ? getSvgOfCommentTip(-1)
                : getSvgOfMuteCommentTip(-1)));
        }
        else {
            $button.innerHTML = commentIconSvg;
            $item.classList.add('incoming');
            $senderIcon = makeElement('span')('icon')();
            $senderIcon.classList.add('sender');
            writeHueAttributes(colorizer, $senderIcon, item.uid);
            const username = item.uid ? usernames.get(item.uid) : undefined;
            if (username != null) {
                $senderIcon.title = username;
            }
            else if (item.uid != null) {
                $senderIcon.title = `#` + item.uid;
            }
            else {
                $senderIcon.title = `anonymous`;
            }
            $senderIcon.innerHTML = getSvgOfSenderUserIcon() + (item.text
                ? getSvgOfCommentTip(1)
                : getSvgOfMuteCommentTip(1));
        }
    }
    $item.append($icon, $balloon);
    if ($senderIcon) {
        $item.append($senderIcon);
    }
    return $item;
}
function trimToCollapsedItemFlow($flow, type, itemOptions) {
    const $pieces = [];
    for (const itemOption of itemOptions) {
        const $piece = $flow.querySelector(`:scope > [data-optional="${itemOption.name}"]`);
        if (!($piece instanceof HTMLElement))
            continue;
        $piece.hidden = !itemOption.get(type);
        if (itemOption.name == 'comment') {
            const comment = readCollapsedItemCommentPieceText($piece);
            if (comment)
                writeCollapsedItemCommentPieceText($piece, comment);
        }
        $pieces.push($piece);
    }
    $flow.replaceChildren();
    let metVisiblePiece = false;
    for (const $piece of $pieces) {
        if (!$piece.hidden && metVisiblePiece)
            $flow.append(' ');
        metVisiblePiece || (metVisiblePiece = !$piece.hidden);
        $flow.append($piece);
    }
}
function writeExpandedItemFlow(colorizer, server, $flow, { type, item }, usernames, itemOptions) {
    const optionalize = (name, $e) => {
        $e.dataset.optional = name;
        $e.hidden = !itemOptions.get(name)?.get(type);
        return $e;
    };
    const makeGeoUri = (lat, lon) => {
        return makeLink(`${lat}, ${lon}`, `geo:${lat},${lon}`);
    };
    const makeBadge = (title, $leftEdge, $rightEdge) => (content, isEmpty = false) => {
        const $badgeContent = makeElement('span')('content')(...content);
        if (isEmpty)
            $badgeContent.classList.add('empty');
        const $badge = makeElement('span')('badge')($badgeContent);
        if ($leftEdge)
            $badge.prepend($leftEdge);
        if ($rightEdge)
            $badge.append($rightEdge);
        if (title)
            $badge.title = title;
        return $badge;
    };
    const makeKnownEditorBadgeOrIcon = (createdBy, editorIcon, url) => {
        const $a = makeLink(``, url);
        if (editorIcon.type == 'svg') {
            $a.innerHTML = `<svg width="16" height="16"><use href="#editor-${editorIcon.id}" /></svg>`;
        }
        else if (editorIcon.type == 'data') {
            $a.innerHTML = `<img width="16" height="16" src="${editorIcon.data}">`;
        }
        else {
            $a.textContent = `🛠️ ` + editorIcon.name;
            return makeBadge(createdBy)([$a]);
        }
        $a.title = createdBy;
        $a.classList.add('editor');
        return $a;
    };
    const makeEditorBadgeOrIconFromCreatedBy = (createdBy) => {
        if (!createdBy) {
            return makeBadge(`unknown editor`)([`🛠️ ?`]);
        }
        for (const [createdByPrefix, url, editorIcon] of editorData) {
            for (const createdByValue of createdBy.split(';')) {
                if (createdByValue.toLowerCase().startsWith(createdByPrefix.toLowerCase())) {
                    return makeKnownEditorBadgeOrIcon(createdBy, editorIcon, url);
                }
            }
        }
        let createdByLead = createdBy;
        const match = createdBy.match(/(.*)(\/|\s+|v)\d/);
        if (match && match[1]) {
            createdByLead = match[1];
        }
        return makeBadge(createdBy)([`🛠️ ${createdByLead ?? '?'}`]);
    };
    const makeEditorBadgeOrIconFromNoteComment = (comment) => {
        for (const [createdByPrefix, url, editorIcon, noteRegExp] of editorData) {
            if (!noteRegExp)
                continue;
            let match;
            if (match = comment.match(noteRegExp)) {
                const [, createdBy] = match;
                return makeKnownEditorBadgeOrIcon(createdBy ?? createdByPrefix, editorIcon, url);
            }
        }
        return null;
    };
    const getBalloonRefHtml = (incoming = false, mute = false, action) => {
        const flip = incoming ? ` transform="scale(-1,1)"` : ``;
        const balloonColors = `fill="transparent" stroke="var(--icon-frame-color)"`;
        let balloon;
        if (mute) {
            balloon = `<g${flip} ${balloonColors}>` +
                `<circle class="balloon-ref" r="6" />` +
                `<circle class="balloon-ref" r="2" cx="-6" cy="4" />` +
                `</g>`;
        }
        else {
            const balloonPathData = `M-8,0 l2,-2 V-4 a2,2 0 0 1 2,-2 H4 a2,2 0 0 1 2,2 V4 a2,2 0 0 1 -2,2 H-4 a2,2 0 0 1 -2,-2 V2 Z`;
            balloon = `<path class="balloon-ref"${flip} d="${balloonPathData}" ${balloonColors} />`;
        }
        let balloonContents = (`<circle r=".7" fill="currentColor" cx="-3" />` +
            `<circle r=".7" fill="currentColor" />` +
            `<circle r=".7" fill="currentColor" cx="3" />`);
        const actionGlyph = getSvgOfActionGlyph(action);
        if (actionGlyph != null) {
            balloonContents = `<g stroke="currentColor" stroke-width="2">${actionGlyph}</g>`;
        }
        return `<svg width="15" height="13" viewBox="${incoming ? -6.5 : -8.5} -6.5 15 13">` +
            balloon + balloonContents +
            `</svg>`;
    };
    const makeCommentRefButton = (uid, order, commentRef) => {
        const $button = makeElement('button')('comment-ref')();
        $button.dataset.order = String(order);
        $button.title = `comment ${order + 1}`;
        writeHueAttributes(colorizer, $button, commentRef.uid);
        $button.innerHTML = getBalloonRefHtml(commentRef.uid != uid, commentRef.mute, commentRef.action);
        return $button;
    };
    const makeAllCommentsBadge = (uid, commentRefs) => {
        if (commentRefs.length > 0) {
            const content = [];
            for (const [i, commentRef] of commentRefs.entries()) {
                if (i)
                    content.push(` `);
                content.push(makeCommentRefButton(uid, i, commentRef));
            }
            if (commentRefs.length > 1) {
                const $leftButton = makeElement('button')('arrow', 'to-right')();
                $leftButton.title = `earlier comment side`;
                const $rightButton = makeElement('button')('arrow', 'to-right')();
                $rightButton.title = `later comment side`;
                return makeBadge(undefined, $leftButton, $rightButton)(content);
            }
            else {
                return makeBadge()(content);
            }
        }
        else {
            const $button = makeElement('button')('comment-ref')();
            $button.disabled = true;
            $button.innerHTML = getBalloonRefHtml();
            return makeBadge(`no comments`)([$button], true);
        }
    };
    const makeNeighborCommentsBadge = (itemType, uid, order, prevCommentRef, nextCommentRef) => {
        if (prevCommentRef || nextCommentRef) {
            const content = [];
            if (nextCommentRef) {
                content.push(makeCommentRefButton(uid, order + 1, nextCommentRef), ` `);
            }
            {
                const $currentCommentIcon = makeElement('span')('marker')();
                writeHueAttributes(colorizer, $currentCommentIcon, uid);
                const svg = getSvgOfCommentIcon(itemType);
                const narrowSvg = svg.replace(`width="8"`, `width="4"`);
                $currentCommentIcon.innerHTML = narrowSvg;
                content.push($currentCommentIcon);
            }
            if (prevCommentRef) {
                content.push(` `, makeCommentRefButton(uid, order - 1, prevCommentRef));
            }
            const $leftButton = makeElement('button')('arrow', 'to-left')();
            $leftButton.title = `later comment side`;
            const $rightButton = makeElement('button')('arrow', 'to-left')();
            $rightButton.title = `earlier comment side`;
            return makeBadge(undefined, $leftButton, $rightButton)(content);
        }
        else {
            const $button = makeElement('button')('comment-ref')();
            $button.disabled = true;
            $button.innerHTML = getBalloonRefHtml();
            return makeBadge(`no comments`)([$button], true);
        }
    };
    const makeSourceBadge = (source) => {
        const bracket = (text) => [
            makeElement('span')('delimiter')(`[`),
            text,
            makeElement('span')('delimiter')(`]`)
        ];
        if (source) {
            return makeBadge(`source`)(bracket(source));
        }
        else {
            return makeBadge(`unspecified source`)(bracket(`?`), true);
        }
    };
    const makeChangesBadge = (changesCount) => {
        if (changesCount > 0) {
            return makeBadge(`number of changes`)([`📝 ${changesCount}`]);
        }
        else {
            return makeBadge(`no changes`)([`📝 ${changesCount}`], true);
        }
    };
    const makeBboxBadge = (bbox) => {
        if (bbox) {
            return makeBadge(`bounding box`)([`⌖ `, makeGeoUri(bbox.minLat, bbox.minLon), ` .. `, makeGeoUri(bbox.maxLat, bbox.maxLon)]);
        }
        else {
            return makeBadge(`no bounding box`)([`⌖ none`], true);
        }
    };
    const rewriteWithLinks = (id, href, apiHref) => {
        const $mainLink = makeLink(String(id), href);
        $mainLink.classList.add('listened');
        const $apiLink = makeLink(`api`, apiHref);
        $apiLink.classList.add('listened');
        $flow.replaceChildren(optionalize('id', $mainLink), ` `, optionalize('api', makeBadge()([$apiLink])));
    };
    const rewriteWithChangesetLinks = (id) => {
        rewriteWithLinks(id, server.web.getUrl(e$2 `changeset/${id}`), server.api.getUrl(e$2 `changeset/${id}.json?include_discussion=true`));
    };
    const rewriteWithNoteLinks = (id) => {
        rewriteWithLinks(id, server.web.getUrl(e$2 `note/${id}`), server.api.getUrl(e$2 `notes/${id}.json`));
    };
    let from = [];
    let date;
    if (type == 'user') {
        date = item.createdAt;
        const apiHref = server.api.getUrl(e$2 `user/${item.id}.json`);
        $flow.replaceChildren(optionalize('api', makeBadge()([makeLink(`api`, apiHref)])), ` `, optionalize('status', makeElement('span')()(`account created`)));
    }
    else if (type == 'changeset' || type == 'changesetClose') {
        date = type == 'changesetClose' ? item.closedAt : item.createdAt;
        rewriteWithChangesetLinks(item.id);
        $flow.append(` `, optionalize('editor', makeEditorBadgeOrIconFromCreatedBy(item.tags.created_by)), ` `, optionalize('source', makeSourceBadge(item.tags.source)), ` `, optionalize('changes', makeChangesBadge(item.changes.count)), ` `, optionalize('position', makeBboxBadge(item.bbox)), ` `, optionalize('refs', makeAllCommentsBadge(item.uid, item.commentRefs)));
        if (item.tags?.comment) {
            $flow.append(` `, optionalize('comment', makeElement('span')()(item.tags?.comment ?? '')));
        }
    }
    else if (type == 'note') {
        date = item.createdAt;
        rewriteWithNoteLinks(item.id);
        if (item.openingComment) {
            const $editorBadge = makeEditorBadgeOrIconFromNoteComment(item.openingComment);
            if ($editorBadge) {
                $flow.append(` `, optionalize('editor', $editorBadge));
            }
        }
        $flow.append(` `, optionalize('position', makeBadge(`position`)([`⌖ `, makeGeoUri(item.lat, item.lon)])), ` `, optionalize('refs', makeAllCommentsBadge(item.uid, item.commentRefs)));
        if (item.openingComment) {
            $flow.append(` `, optionalize('comment', makeElement('span')()(item.openingComment)));
        }
    }
    else if (type == 'changesetComment' || type == 'noteComment') {
        date = item.createdAt;
        let username;
        if (item.uid) {
            username = usernames.get(item.uid);
        }
        let itemType;
        if (type == 'changesetComment') {
            itemType = 'changeset';
            rewriteWithChangesetLinks(item.itemId);
        }
        else if (type == 'noteComment') {
            itemType = 'note';
            rewriteWithNoteLinks(item.itemId);
        }
        else {
            return;
        }
        if (item.uid != item.itemUid) {
            const $senderIcon = makeElement('span')('icon')();
            $senderIcon.classList.add('sender');
            $senderIcon.innerHTML = getSvgOfSenderUserIcon() + (item.text
                ? getSvgOfCommentTip(1)
                : ``);
            from.push($senderIcon);
            if (username != null) {
                from.push(makeLink(username, server.web.getUrl(e$2 `user/${username}`)));
            }
            else if (item.uid != null) {
                from.push(`#${item.uid}`);
            }
            else {
                from.push(`anonymous`);
            }
        }
        if (item.prevCommentRef || item.nextCommentRef) {
            $flow.append(` `, optionalize('refs', makeNeighborCommentsBadge(itemType, item.itemUid, item.order, item.prevCommentRef, item.nextCommentRef)));
        }
        if (item.text) {
            $flow.append(` `, optionalize('comment', makeElement('span')()(item.text)));
        }
    }
    else {
        return;
    }
    if (date) {
        $flow.prepend(optionalize('date', makeDateOutput(date)), ` `);
    }
    if (from.length > 0) {
        $flow.prepend(makeElement('span')('from')(...from), ` `);
    }
}
function makeCollectionIcon() {
    const $icon = makeElement('span')('icon')();
    const r = 4;
    const c1 = -10;
    const c2 = 10 - 2 * r;
    $icon.innerHTML = makeCenteredSvg(10, `<rect x="${c1}" y="${c1}" width="${2 * r}" height="${2 * r}" />` +
        `<rect x="${c1}" y="${c2}" width="${2 * r}" height="${2 * r}" />` +
        `<rect x="${c2}" y="${c1}" width="${2 * r}" height="${2 * r}" />` +
        `<rect x="${c2}" y="${c2}" width="${2 * r}" height="${2 * r}" />` +
        `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" />`, `fill="currentColor"`);
    return $icon;
}
function writeNewUserIcon($icon, id) {
    $icon.title = id != null ? `user ${id}` : `anonymous user`;
    $icon.innerHTML = makeCenteredSvg(10, `<path d="${computeNewOutlinePath(9, 7, 10)}" fill="canvas" stroke="currentColor" stroke-width="2" />` +
        makeUserSvgElements());
}
function getSvgOfSenderUserIcon() {
    return makeCenteredSvg(8, makeUserSvgElements());
}
function writeChangesetIcon($icon, id, isClosed, isEmpty, size) {
    if (isClosed) {
        const $button = makeElement('button')('ref')();
        $button.title = `closed changeset ${id}`;
        $button.innerHTML = makeCenteredSvg(6 + size, `<line y1="-5" y2="5" />` +
            `<path d="M-5,0 L0,5 L5,0" fill="none" />`, `stroke="currentColor" stroke-width="2"`);
        $icon.append($button);
    }
    else if (isEmpty) {
        $icon.innerHTML = makeCenteredSvg(10, `<path d="M-7.5,5.5 V-7.5 H5.5" />` +
            `<path d="M-8.5,8.5 L8.5,-8.5" />` +
            `<path d="M-5.5,7.5 H7.5 V-5.5" />`, `fill="none" stroke="currentColor"`);
    }
    if (!isClosed) {
        const $checkbox = makeElement('input')()();
        $checkbox.type = 'checkbox';
        $checkbox.title = `opened changeset ${id}`;
        $icon.append($checkbox);
    }
}
function writeNoteIcon($icon, id) {
    const $anchor = makeElement('a')()();
    $anchor.tabIndex = 0;
    $anchor.title = `note ${id}`;
    const s = 3;
    $anchor.innerHTML = makeCenteredSvg(10, `<path d="${computeNewOutlinePath(9.5, 8, 10)}" fill="none" stroke-width="1" />` +
        `<path d="${computeMarkerOutlinePath(16, 6)}" fill="canvas" />` +
        `<line x1="${-s}" x2="${s}" />` +
        `<line y1="${-s}" y2="${s}" />`, `stroke="currentColor" stroke-width="2"`);
    $icon.append($anchor);
}
function getSvgOfCommentIcon(itemType, action) {
    if (itemType == 'note') {
        const actionGlyph = getSvgOfActionGlyph(action);
        if (actionGlyph != null) {
            return makeCenteredSvg(10, `<path d="${computeMarkerOutlinePath(16, 6)}" fill="canvas" />` +
                actionGlyph, `stroke="currentColor" stroke-width="2"`);
        }
        else {
            const r = 4;
            return makeCenteredSvg(r, `<circle r=${r} fill="currentColor" />`);
        }
    }
    else {
        const r = 4;
        return makeCenteredSvg(r, `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" fill="currentColor" />`);
    }
}
function getSvgOfActionGlyph(action) {
    const s = 2.5;
    if (action == 'closed') {
        return `<path d="M${-s},0 L0,${s} L${s},${-s}" fill="none" />`;
    }
    else if (action == 'reopened') {
        return (`<line x1="${-s}" x2="${s}" y1="${-s}" y2="${s}" />` +
            `<line x1="${-s}" x2="${s}" y1="${s}" y2="${-s}" />`);
    }
    else if (action == 'hidden') {
        return ``;
    }
}
function getSvgOfCommentTip(side) {
    return `<svg class="tip" width="7" height="13" viewBox="${side < 0 ? -.5 : -5.5} -6.5 7 13" fill="canvas">` +
        `<path d="M0,0L${-7 * side},7V-7Z" class="balloon-part"></path>` +
        `<path d="M${-6 * side},-6L0,0L${-6 * side},6" fill="none" stroke="var(--balloon-frame-color)"></path>` +
        `</svg>`;
}
function getSvgOfMuteCommentTip(side) {
    return `<svg class="tip" width="15" height="20" viewBox="${side < 0 ? 0 : -15} -10 15 20" fill="canvas" stroke="var(--balloon-frame-color)">` +
        `<circle cx="${-10.5 * side}" cy="-3.5" r="4" class="balloon-part" />` +
        `<circle cx="${-5.5 * side}" cy="1.5" r="2" class="balloon-part" />` +
        `</svg>`;
}
function computeMarkerOutlinePath(h, r) {
    const rp = h - r;
    const y = r ** 2 / rp;
    const x = Math.sqrt(r ** 2 - y ** 2);
    const xf = x.toFixed(2);
    const yf = y.toFixed(2);
    return `M0,${rp} L-${xf},${yf} A${r},${r} 0 1 1 ${xf},${yf} Z`;
}
function computeNewOutlinePath(R, r, n) {
    let outline = ``;
    for (let i = 0; i < n * 2; i++) {
        const a = Math.PI * i / n;
        const s = i & 1 ? r : R;
        outline += (i ? 'L' : 'M') +
            (s * Math.cos(a)).toFixed(2) + ',' +
            (s * Math.sin(a)).toFixed(2);
    }
    outline += 'Z';
    return outline;
}
function makeUserSvgElements() {
    return (`<circle cx="0" cy="-2" r="2.5" fill="currentColor" />` +
        `<path d="M -4,5.5 A 4 4 0 0 1 4,5.5 Z" fill="currentColor" />`);
}

function makeAllTab() {
    const $icon = makeElement('span')('icon')();
    $icon.title = `all user items`;
    $icon.innerHTML = makeCenteredSvg(8, `<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" />` +
        `<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(60)" />` +
        `<line y1="-6" y2="6" stroke="currentColor" stroke-width="2" transform="rotate(-60)" />`);
    return makeDiv('tab')($icon);
}
function makeUserTab(removeColumnClickListener, query) {
    const $icon = makeElement('span')('icon')();
    $icon.title = `user`;
    $icon.innerHTML = makeCenteredSvg(8, makeUserSvgElements());
    const $label = makeElement('span')('column-label')();
    if (query.type == 'id') {
        $label.append(`#${query.uid}`);
    }
    else {
        $label.append(query.username);
    }
    const $closeButton = makeCloseButton(removeColumnClickListener);
    $closeButton.title = `Remove user`;
    return makeDiv('tab')($icon, ` `, $label, ` `, $closeButton);
}
function makeFormTab(removeColumnClickListener) {
    const $label = makeElement('span')('column-label')(`Add user`);
    const $closeButton = makeCloseButton(removeColumnClickListener);
    $closeButton.title = `Remove form`;
    return makeDiv('tab')($label, ` `, $closeButton);
}
function makeCloseButton(removeColumnClickListener) {
    const $closeButton = makeElement('button')('with-icon')();
    $closeButton.innerHTML = `<svg width="16" height="16"><use href="#close" /></svg>`;
    $closeButton.addEventListener('click', removeColumnClickListener);
    return $closeButton;
}
function makeUserCard(colorizer, $displayedChangesetsCount, $displayedNotesCount, update, rescan, changeUidHue) {
    const hide = ($e) => {
        $e.hidden = true;
        return $e;
    };
    const makeCountsField = (className, title, $displayedCount) => {
        // $displayedCount.classList.add('displayed')
        const $downloadedCount = makeElement('output')('downloaded')();
        const $totalCount = makeElement('output')('total')();
        return makeDiv('field', className)(`${title}: `, $displayedCount, ` / `, $downloadedCount, ` / `, $totalCount);
    };
    const at = () => makeElement('output')('at')();
    const makeUpdateButton = (title, callback) => {
        const $button = makeElement('button')('with-icon')();
        $button.title = title;
        $button.innerHTML = `<svg width="16" height="16"><use href="#repeat" /></svg>`;
        $button.onclick = () => {
            callback();
            rotateButton($button);
        };
        return $button;
    };
    const makeUpdatesLi = (type) => makeElement('li')(type)(`${type}: `, at(), ` `, makeUpdateButton(`rescan`, () => {
        const uidString = $card.dataset.uid;
        if (uidString == null)
            return;
        rescan(type, Number(uidString));
    }));
    const $card = makeDiv('card')(hide(makeDiv('notice')()), hide(makeDiv('avatar')()), hide(makeDiv('field', 'name')()), hide(makeDiv('field', 'created-at')(`account created at `, at())), hide(makeCountsField('changesets', `changesets`, $displayedChangesetsCount)), hide(makeCountsField('notes', `notes`, $displayedNotesCount)), hide(makeDiv('field', 'updates')(`info updated at:`, ul(makeElement('li')('name')(`username: `, at()), makeElement('li')('details')(`user details: `, at(), ` `, makeUpdateButton(`update`, update)), makeUpdatesLi('changesets'), makeUpdatesLi('notes')))), hide(makeHuePicker(hue => {
        const uidString = $card.dataset.uid;
        if (uidString == null)
            return;
        const uid = Number(uidString);
        colorizer.setHueForUid(uid, hue);
        changeUidHue(uid);
    })));
    return $card;
}
function updateUserCard(colorizer, $card, info, getUserNameHref, getUserIdHref) {
    if (info.status == 'rerunning' || info.status == 'ready') {
        $card.dataset.uid = String(info.user.id);
    }
    else {
        delete $card.dataset.uid;
    }
    const $notice = $card.querySelector(':scope > .notice');
    const $avatar = $card.querySelector(':scope > .avatar');
    const $nameField = $card.querySelector(':scope > .field.name');
    const $createdAtField = $card.querySelector(':scope > .field.created-at');
    const $changesetsField = $card.querySelector(':scope > .field.changesets');
    const $notesField = $card.querySelector(':scope > .field.notes');
    const $updatesField = $card.querySelector(':scope > .field.updates');
    const $huePicker = $card.querySelector(':scope > .hue-picker');
    if ($notice instanceof HTMLElement) {
        if (info.status == 'pending' || info.status == 'running') {
            $notice.hidden = false;
            $notice.textContent = `waiting for user data`;
        }
        else if (info.status == 'failed') {
            $notice.hidden = false;
            $notice.textContent = `unable to get user data`;
        }
        else {
            $notice.hidden = true;
            $notice.textContent = ``;
        }
    }
    if ($avatar instanceof HTMLElement) {
        if ((info.status == 'rerunning' || info.status == 'ready') &&
            info.user.withDetails && info.user.visible && info.user.img) {
            $avatar.hidden = false;
            const $img = makeElement('img')()();
            $img.src = info.user.img.href;
            $avatar.replaceChildren($img);
        }
        else {
            $avatar.hidden = true;
            $avatar.replaceChildren();
        }
    }
    if ($nameField instanceof HTMLElement) {
        if (info.status == 'rerunning' || info.status == 'ready') {
            $nameField.hidden = false;
            const notKnownToBeDelelted = !info.user.withDetails || info.user.visible;
            let namePlaceholder;
            if (info.user.name) {
                const decoratedName = decorateUserName(info.user.name);
                namePlaceholder = decoratedName.map(([text, warning]) => {
                    if (!warning)
                        return text;
                    const $chunk = makeElement('span')('with-warning')(text);
                    $chunk.title = `${warning.belongsTo} inside ${warning.surroundedBy}`;
                    return $chunk;
                });
                if (notKnownToBeDelelted) {
                    const $a = makeElement('a')()(...namePlaceholder);
                    $a.href = getUserNameHref(info.user.name);
                    namePlaceholder = [$a];
                }
            }
            else {
                if (notKnownToBeDelelted) {
                    namePlaceholder = [`user without requested details`];
                }
                else {
                    namePlaceholder = [`deleted user`];
                }
            }
            $nameField.replaceChildren(...namePlaceholder, ` `, makeElement('span')('api')(`(`, makeLink(`#${info.user.id}`, getUserIdHref(info.user.id)), `)`));
        }
        else {
            $nameField.hidden = true;
            $nameField.replaceChildren();
        }
    }
    if ($createdAtField instanceof HTMLElement) {
        if ((info.status == 'rerunning' || info.status == 'ready') &&
            info.user.withDetails) {
            $createdAtField.hidden = false;
            const $at = $createdAtField.querySelector(':scope > output.at');
            if ($at instanceof HTMLElement) {
                if (info.user.visible) {
                    $at.replaceChildren(makeDateOutput(info.user.createdAt));
                }
                else {
                    const $unknown = makeElement('span')()(`???`);
                    $unknown.title = `date is unknown because the user is deleted`;
                    $at.replaceChildren($unknown);
                }
            }
        }
        else {
            $createdAtField.hidden = true;
        }
    }
    if ($changesetsField instanceof HTMLElement) {
        if (info.status == 'rerunning' || info.status == 'ready') {
            $changesetsField.hidden = false;
            const $downloadedCount = $changesetsField.querySelector(':scope > output.downloaded');
            if ($downloadedCount instanceof HTMLElement) {
                $downloadedCount.textContent = (info.scans.changesets
                    ? String(info.scans.changesets.items.count)
                    : `0`);
                $downloadedCount.title = `downloaded`;
            }
            const $totalCount = $changesetsField.querySelector(':scope > output.total');
            if ($totalCount instanceof HTMLElement) {
                if (info.user.withDetails && info.user.visible) {
                    $totalCount.textContent = String(info.user.changesets.count);
                    $totalCount.title = `opened by the user`;
                }
                else {
                    $totalCount.textContent = `???`;
                    $totalCount.title = `number of changesets opened by the user is unknown because ` + (info.user.withDetails
                        ? `user details weren't requested`
                        : `the user is deleted`);
                }
            }
        }
        else {
            $changesetsField.hidden = true;
        }
    }
    if ($notesField instanceof HTMLElement) {
        if (info.status == 'rerunning' || info.status == 'ready') {
            $notesField.hidden = false;
            const $downloadedCount = $notesField.querySelector(':scope > output.downloaded');
            if ($downloadedCount instanceof HTMLElement) {
                $downloadedCount.textContent = (info.scans.notes
                    ? String(info.scans.notes.items.count)
                    : `0`);
                $downloadedCount.title = `downloaded`;
            }
            const $totalCount = $notesField.querySelector(':scope > output.total');
            if ($totalCount instanceof HTMLElement) {
                $totalCount.textContent = `???`;
                $totalCount.title = `number of notes created by the user is unknown because the API doesn't report it`;
            }
        }
        else {
            $notesField.hidden = true;
        }
    }
    if ($updatesField instanceof HTMLElement) {
        if (info.status == 'rerunning' || info.status == 'ready') {
            $updatesField.hidden = false;
            const $nameAt = $updatesField.querySelector(':scope > ul > li.name > output.at');
            if ($nameAt instanceof HTMLElement) {
                $nameAt.replaceChildren(makeDateOutput(info.user.nameUpdatedAt));
            }
            const $updateDetailsButton = $updatesField.querySelector(':scope > ul > li.details > button');
            if ($updateDetailsButton instanceof HTMLButtonElement) {
                $updateDetailsButton.disabled = info.status == 'rerunning';
            }
            const $detailsAt = $updatesField.querySelector(':scope > ul > li.details > output.at');
            if ($detailsAt instanceof HTMLElement) {
                $detailsAt.replaceChildren(info.user.withDetails
                    ? makeDateOutput(info.user.detailsUpdatedAt)
                    : `not requested`);
            }
            const updateScan = ($at, scan) => {
                $at.replaceChildren();
                if (!scan) {
                    $at.append(`not started`);
                    return;
                }
                $at.append(makeDateOutput(scan.beginDate));
                if (scan.endDate) {
                    $at.append(`..`, makeDateOutput(scan.endDate));
                }
                else {
                    const $incomplete = makeElement('span')()(`...`);
                    $incomplete.title = `incomplete`;
                    $at.append($incomplete);
                }
            };
            const $changesetsAt = $updatesField.querySelector(':scope > ul > li.changesets > output.at');
            if ($changesetsAt instanceof HTMLElement) {
                updateScan($changesetsAt, info.scans.changesets);
            }
            const $notesAt = $updatesField.querySelector(':scope > ul > li.notes > output.at');
            if ($notesAt instanceof HTMLElement) {
                updateScan($notesAt, info.scans.notes);
            }
        }
        else {
            $updatesField.hidden = true;
        }
    }
    if ($huePicker instanceof HTMLElement) {
        if (info.status == 'rerunning' || info.status == 'ready') {
            $huePicker.hidden = false;
            const hue = colorizer.getHueForUid(info.user.id);
            updateHuePicker($huePicker, hue);
        }
        else {
            $huePicker.hidden = true;
        }
    }
}
function makeFormCard(getUserQueryFromInputValue, processValidUserQuery) {
    const $card = makeDiv('card')();
    const $userInput = makeElement('input')()();
    $userInput.type = 'text';
    $userInput.name = 'user';
    $userInput.oninput = () => {
        const query = getUserQueryFromInputValue($userInput.value);
        if (query.type == 'invalid') {
            $userInput.setCustomValidity(query.message);
        }
        else if (query.type == 'empty') {
            $userInput.setCustomValidity(`user query cannot be empty`);
        }
        else {
            $userInput.setCustomValidity('');
        }
    };
    const $form = makeElement('form')()(makeDiv('major-input-group')(makeLabel()(`Username, URL or #id `, $userInput)), makeDiv('major-input-group')(makeElement('button')()(`Add user`)));
    $form.onsubmit = async (ev) => {
        ev.preventDefault();
        const query = getUserQueryFromInputValue($userInput.value);
        if (query.type == 'invalid' || query.type == 'empty')
            return;
        processValidUserQuery(query);
    };
    $card.append($form);
    return $card;
}
function makeUserSelector(selectAllItemsListener) {
    const $checkbox = makeElement('input')()();
    $checkbox.type = 'checkbox';
    $checkbox.oninput = () => selectAllItemsListener($checkbox);
    const $icon = makeElement('span')('icon')($checkbox);
    return makeDiv('selector')($icon, ` `, makeElement('output')('column-label')());
}
function makeFormSelector() {
    return makeDiv('selector')();
}
function rotateButton($button) {
    requestAnimationFrame(() => {
        $button.style.removeProperty('transition');
        $button.style.removeProperty('rotate');
        requestAnimationFrame(() => {
            $button.style.transition = `rotate 200ms`;
            $button.style.rotate = `1turn`;
        });
    });
}

function toUserQuery(apiUrlLister, webUrlLister, value) {
    const s = value.trim();
    if (s == '')
        return {
            type: 'empty'
        };
    if (s[0] == '#') {
        let match;
        if (match = s.match(/^#\s*(\d+)$/)) {
            const [, uid] = match;
            return {
                type: 'id',
                uid: Number(uid)
            };
        }
        else if (match = s.match(/^#\s*\d*(.)/)) {
            const [, c] = match;
            return {
                type: 'invalid',
                message: `uid cannot contain non-digits, found ${c}`
            };
        }
        else {
            return {
                type: 'invalid',
                message: `uid cannot be empty`
            };
        }
    }
    if (s.includes('/')) {
        const hosts = new Set();
        for (const urlString of [apiUrlLister.url, ...webUrlLister.urls]) {
            try {
                const url = new URL(urlString);
                hosts.add(url.host);
            }
            catch { }
        }
        try {
            const url = new URL(s);
            if (!hosts.has(url.host)) {
                let domainString = `was given ${url.host}`;
                if (!url.host)
                    domainString = `no domain was given`;
                return {
                    type: 'invalid',
                    message: `URL has to be of an OSM domain, ${domainString}`
                };
            }
            const [, typeDir] = url.pathname.split('/', 2);
            if (typeDir == 'user') {
                const [, , userDir] = url.pathname.split('/', 3);
                if (!userDir)
                    return {
                        type: 'invalid',
                        message: `OSM user URL has to include username`
                    };
                return {
                    type: 'name',
                    username: decodeURIComponent(userDir)
                };
            }
            else if (typeDir == 'api') {
                const [, , apiVersionDir, apiCall, apiValue] = url.pathname.split('/', 5);
                if (apiVersionDir != '0.6' || apiCall != 'user')
                    return {
                        type: 'invalid',
                        message: `OSM API URL has to be "api/0.6/user/..."`
                    };
                const [uidString] = apiValue.split('.');
                const uid = Number(uidString);
                if (!Number.isInteger(uid))
                    return {
                        type: 'invalid',
                        message: `OSM API URL has to include valid user id"`
                    };
                return {
                    type: 'id',
                    uid
                };
            }
            else {
                return {
                    type: 'invalid',
                    message: `OSM URL has to be either user page or user api link`
                };
            }
        }
        catch {
            return {
                type: 'invalid',
                message: `string containing "/" character has to be a valid URL`
            };
        }
    }
    return {
        type: 'name',
        username: s
    };
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

const USER = 0;
const CHANGESET = 1;
const CHANGESET_CLOSE = 2;
const NOTE = 3;
const CHANGESET_COMMENT = 4;
const NOTE_COMMENT = 5;
// { https://stackoverflow.com/a/42919752
const iTop = 0;
const iParent = (i) => ((i + 1) >>> 1) - 1;
const iLeft = (i) => (i << 1) + 1;
const iRight = (i) => (i + 1) << 1;
class MuxUserItemPriorityQueue {
    constructor() {
        this.heap = [];
    }
    get size() {
        return this.heap.length;
    }
    get isEmpty() {
        return this.size == 0;
    }
    peek() {
        return this.heap[iTop];
    }
    push(value) {
        this.heap.push(value);
        this.siftUp();
    }
    pop() {
        const poppedValue = this.peek();
        const bottom = this.size - 1;
        if (bottom > iTop) {
            this.swap(iTop, bottom);
        }
        this.heap.pop();
        this.siftDown();
        return poppedValue;
    }
    greater(i, j) {
        const [timestamp1, type1, item1] = this.heap[i];
        const [timestamp2, type2, item2] = this.heap[j];
        if (timestamp1 != timestamp2)
            return timestamp1 > timestamp2;
        if (type1 == CHANGESET_COMMENT || type1 == NOTE_COMMENT) {
            if (type2 == CHANGESET_COMMENT || type2 == NOTE_COMMENT) {
                if (type1 != type2)
                    return type1 > type2;
                if (item1.itemUid != item2.itemUid)
                    return item1.itemUid > item2.itemUid;
                return item1.order > item2.order;
            }
            else {
                return type1 > type2;
            }
        }
        else {
            if (type2 == CHANGESET_COMMENT || type2 == NOTE_COMMENT) {
                return type1 > type2;
            }
            else {
                return item1.id > item2.id;
            }
        }
    }
    swap(i, j) {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }
    siftUp() {
        let node = this.size - 1;
        while (node > iTop && this.greater(node, iParent(node))) {
            this.swap(node, iParent(node));
            node = iParent(node);
        }
    }
    siftDown() {
        let node = iTop;
        while ((iLeft(node) < this.size && this.greater(iLeft(node), node)) ||
            (iRight(node) < this.size && this.greater(iRight(node), node))) {
            let maxChild = (iRight(node) < this.size && this.greater(iRight(node), iLeft(node))) ? iRight(node) : iLeft(node);
            this.swap(node, maxChild);
            node = maxChild;
        }
    }
}
class MuxUserItemDbStream {
    constructor(db, users) {
        this.db = db;
        this.queue = new MuxUserItemPriorityQueue();
        const itemTypes = ['changesets', 'notes'];
        this.muxEntries = users.flatMap(({ id }) => (itemTypes.map(itemType => ({
            itemType,
            uid: id,
            scan: null,
            boundary: new StreamBoundary(),
        }))));
        for (const user of users) {
            if (!user.withDetails || !user.visible)
                continue;
            this.queue.push([user.createdAt.getTime(), USER, user]);
        }
    }
    async getNextAction() {
        for (const muxEntry of this.muxEntries) {
            const { itemType, uid } = muxEntry;
            if (!muxEntry.scan) {
                const scan = await this.db.getCurrentUserScan(itemType, uid);
                if (!scan) {
                    return {
                        type: 'scan',
                        start: true,
                        itemType, uid
                    };
                }
                muxEntry.scan = scan;
            }
            if (muxEntry.boundary.isStarted)
                continue;
            const continueScan = await this.enqueueMoreItemsAndCheckIfNeedToContinueScan(muxEntry);
            if (continueScan) {
                return {
                    type: 'scan',
                    start: false,
                    itemType, uid
                };
            }
        }
        const commenterUids = new Set();
        const batch = [];
        const moveQueueTopToResults = () => {
            const [, type, item] = this.queue.pop();
            if (type == USER) {
                batch.push({ type: 'user', item });
            }
            else if (type == CHANGESET) {
                batch.push({ type: 'changeset', item });
            }
            else if (type == CHANGESET_CLOSE) {
                batch.push({ type: 'changesetClose', item });
            }
            else if (type == NOTE) {
                batch.push({ type: 'note', item });
            }
            else if (type == CHANGESET_COMMENT) {
                batch.push({ type: 'changesetComment', item });
                if (item.uid != null)
                    commenterUids.add(item.uid);
            }
            else if (type == NOTE_COMMENT) {
                batch.push({ type: 'noteComment', item });
                if (item.uid != null)
                    commenterUids.add(item.uid);
            }
        };
        let loopLimit = 100;
        while (loopLimit-- > 0) {
            let upperTimestamp = -Infinity;
            let upperMuxEntry;
            for (const muxEntry of this.muxEntries) {
                if (upperTimestamp >= muxEntry.boundary.timestamp)
                    continue;
                upperTimestamp = muxEntry.boundary.timestamp;
                upperMuxEntry = muxEntry;
            }
            while (!this.queue.isEmpty) {
                const [timestamp] = this.queue.peek();
                if (timestamp < upperTimestamp)
                    break;
                moveQueueTopToResults();
            }
            if (batch.length > 0) {
                return {
                    type: 'batch',
                    batch,
                    usernames: await this.db.getUserNames(commenterUids)
                };
            }
            if (upperMuxEntry) {
                const { itemType, uid } = upperMuxEntry;
                if (await this.enqueueMoreItemsAndCheckIfNeedToContinueScan(upperMuxEntry)) {
                    return {
                        type: 'scan',
                        start: false,
                        itemType, uid
                    };
                }
            }
            else {
                break;
            }
        }
        if (loopLimit <= 0) {
            throw new RangeError(`too many iterations in mux stream db/queue read loop`);
        }
        return { type: 'end' };
    }
    async enqueueMoreItemsAndCheckIfNeedToContinueScan(muxEntry) {
        if (!muxEntry.scan)
            throw new RangeError(`no expected user item scan`);
        let oldBoundaryTimestamp = muxEntry.boundary.timestamp;
        let isEmptyDbGet = true;
        if (muxEntry.itemType == 'changesets') {
            const changesetsWithComments = await this.db.getUserItems(muxEntry.itemType, muxEntry.uid, muxEntry.scan, muxEntry.boundary, 100);
            for (const [changeset, comments] of changesetsWithComments) {
                isEmptyDbGet = false;
                for (const comment of comments) {
                    this.queue.push([comment.createdAt.getTime(), CHANGESET_COMMENT, comment]);
                }
                if (changeset.closedAt) {
                    this.queue.push([changeset.closedAt.getTime(), CHANGESET_CLOSE, changeset]);
                }
                this.queue.push([changeset.createdAt.getTime(), CHANGESET, changeset]);
            }
        }
        else if (muxEntry.itemType == 'notes') {
            const notesWithComments = await this.db.getUserItems(muxEntry.itemType, muxEntry.uid, muxEntry.scan, muxEntry.boundary, 100);
            for (const [note, comments] of notesWithComments) {
                isEmptyDbGet = false;
                for (const comment of comments) {
                    this.queue.push([comment.createdAt.getTime(), NOTE_COMMENT, comment]);
                }
                this.queue.push([note.createdAt.getTime(), NOTE, note]);
            }
        }
        if (isEmptyDbGet && muxEntry.boundary.timestamp >= oldBoundaryTimestamp && !muxEntry.scan.endDate) {
            muxEntry.scan = null;
            return true;
        }
        return false;
    }
}

class MuxUserItemDbStreamMessenger {
    constructor(host, worker, stream, columnUids, receiveBatch) {
        this.host = host;
        this.worker = worker;
        this.stream = stream;
        this.columnUids = columnUids;
        this.receiveBatch = receiveBatch;
        this.uidToColumns = new Map();
        this.watchedUids = new Set();
        this.updateUidToColumns();
    }
    updateUidToColumns() {
        this.uidToColumns.clear();
        for (const [iColumn, uid] of this.columnUids.entries()) {
            if (uid == null)
                continue;
            if (!this.uidToColumns.has(uid)) {
                this.uidToColumns.set(uid, []);
            }
            this.uidToColumns.get(uid)?.push(iColumn);
        }
    }
    reorderColumns(iShiftFrom, iShiftTo) {
        moveInArray(this.columnUids, iShiftFrom, iShiftTo);
        this.updateUidToColumns();
    }
    async requestNextBatch() {
        const action = await this.stream.getNextAction();
        if (action.type == 'scan') {
            this.watchedUids.add(action.uid);
            this.worker.port.postMessage({
                type: 'scanUserItems',
                host: this.host,
                start: action.start,
                itemType: action.itemType,
                uid: action.uid,
            });
        }
        else if (action.type == 'batch') {
            this.receiveBatch(action.batch.map((batchItem) => ({
                ...batchItem,
                iColumns: this.uidToColumns.get(getMuxBatchItemUid(batchItem)) ?? []
            })), action.usernames);
        }
        else if (action.type == 'end') {
            this.receiveBatch([], new Map());
        }
    }
    async receiveMessage(messagePart) {
        if (messagePart.type == 'scanUserItems') {
            if (messagePart.status == 'ready' && this.watchedUids.has(messagePart.uid)) {
                this.watchedUids.delete(messagePart.uid);
                await this.requestNextBatch();
            }
        }
    }
}
function getMuxBatchItemUid(batchItem) {
    if (batchItem.type == 'user') {
        return batchItem.item.id;
    }
    if (batchItem.type == 'changesetComment' || batchItem.type == 'noteComment') {
        return batchItem.item.itemUid;
    }
    else {
        return batchItem.item.uid;
    }
}

const e$1 = makeEscapeTag(encodeURIComponent);
class GridHead {
    constructor(colorizer, cx, db, worker, 
    // former direct grid method calls:
    setColumns, reorderColumns, getColumnCheckboxStatuses, triggerColumnCheckboxes, changeUidHue, 
    // former main callbacks:
    sendUpdatedUserQueriesReceiver, restartStreamCallback, readyStreamCallback, receiveBatchCallback) {
        this.colorizer = colorizer;
        this.cx = cx;
        this.db = db;
        this.worker = worker;
        this.setColumns = setColumns;
        this.reorderColumns = reorderColumns;
        this.getColumnCheckboxStatuses = getColumnCheckboxStatuses;
        this.triggerColumnCheckboxes = triggerColumnCheckboxes;
        this.changeUidHue = changeUidHue;
        this.sendUpdatedUserQueriesReceiver = sendUpdatedUserQueriesReceiver;
        this.restartStreamCallback = restartStreamCallback;
        this.readyStreamCallback = readyStreamCallback;
        this.receiveBatchCallback = receiveBatchCallback;
        this.$gridHead = makeElement('thead')()();
        this.userEntries = [];
        {
            const that = this;
            this.wrappedRemoveColumnClickListener = function () {
                that.removeColumnClickListener(this);
            };
        }
        this.$tabRow = this.$gridHead.insertRow();
        this.$cardRow = this.$gridHead.insertRow();
        this.$selectorRow = this.$gridHead.insertRow();
        this.$selectorRow.classList.add('selectors');
        this.$adderCell = makeElement('th')('all')();
        this.$tabRow.append(this.$adderCell);
        const $adderButton = makeElement('button')()(`+`);
        $adderButton.onclick = () => {
            const formEntry = this.makeFormUserEntry();
            this.userEntries.push(formEntry);
            // this.appendUserEntryToHead(formEntry)
            this.rewriteUserEntriesInHead();
            this.restartStream();
        };
        this.$adderCell.append(makeDiv('tab')($adderButton));
        const broadcastReceiver = new WorkerBroadcastReceiver(cx.server.host);
        broadcastReceiver.onmessage = async ({ data: message }) => {
            if (message.type != 'operation')
                return;
            const replaceUserCard = (userEntry) => {
                const { $tab, $card, $selector } = userEntry;
                const uid = getUserEntryUid(userEntry);
                if ($tab.parentElement)
                    writeHueAttributes(colorizer, $tab.parentElement, uid);
                if ($card.parentElement)
                    writeHueAttributes(colorizer, $card.parentElement, uid);
                if ($selector.parentElement)
                    writeHueAttributes(colorizer, $selector.parentElement, uid);
                this.updateUserCard($card, userEntry.info);
            };
            if (message.part.type == 'getUserInfo') {
                for (const userEntry of this.userEntries) {
                    if (userEntry.type != 'query')
                        continue;
                    if (!isSameQuery(userEntry.query, message.part.query))
                        continue;
                    if (message.part.status == 'running') {
                        if (userEntry.info.status == 'rerunning' || userEntry.info.status == 'ready') {
                            userEntry.info = {
                                status: 'rerunning',
                                user: userEntry.info.user,
                                scans: userEntry.info.scans
                            };
                        }
                        else {
                            userEntry.info = { status: message.part.status };
                        }
                    }
                    else if (message.part.status == 'failed') {
                        userEntry.info = { status: message.part.status };
                    }
                    else if (message.part.status == 'ready') {
                        const info = await this.askDbForUserInfo(message.part.query);
                        if (info) {
                            userEntry.info = info;
                        }
                        else {
                            userEntry.info = {
                                status: 'failed'
                            };
                        }
                    }
                    else {
                        continue;
                    }
                    replaceUserCard(userEntry);
                }
                this.startStreamIfNotStartedAndGotAllUids();
            }
            else if (message.part.type == 'scanUserItems' && message.part.status == 'ready') {
                for (const userEntry of this.userEntries) {
                    if (userEntry.type != 'query')
                        continue;
                    if (userEntry.info.status != 'ready')
                        continue;
                    if (userEntry.info.user.id != message.part.uid)
                        continue;
                    const info = await this.askDbForUserInfo({ type: 'id', uid: message.part.uid });
                    if (info) {
                        userEntry.info = info;
                        replaceUserCard(userEntry);
                    }
                }
            }
            if (this.streamMessenger) {
                await this.streamMessenger.receiveMessage(message.part);
            }
        };
    }
    async receiveUpdatedUserQueries(userQueries) {
        const newUserEntries = [];
        if (userQueries.length == 0) {
            newUserEntries.push(this.makeFormUserEntry());
        }
        else {
            for (const query of userQueries) {
                let entry = this.pickFromExistingUserEntries(query);
                if (!entry) {
                    entry = await this.makeQueryUserEntry(query);
                }
                newUserEntries.push(entry);
            }
        }
        this.userEntries = newUserEntries;
        this.rewriteUserEntriesInHead();
        this.restartStream();
    }
    async addUserQueries(userQueries) {
        for (const query of userQueries) {
            const entry = await this.makeQueryUserEntry(query);
            this.userEntries.push(entry);
        }
        this.rewriteUserEntriesInHead();
        this.sendUpdatedUserQueries();
        this.restartStream();
    }
    updateSelectors() {
        const updateCheckboxState = ($checkbox, checked, unchecked) => {
            $checkbox.checked = (checked && !unchecked);
            $checkbox.indeterminate = (checked && unchecked);
        };
        const [hasChecked, hasUnchecked, selectedChangesetIds] = this.getColumnCheckboxStatuses();
        for (const [iColumn, { $selector }] of this.userEntries.entries()) {
            const $checkbox = $selector.querySelector('input[type=checkbox]');
            if ($checkbox instanceof HTMLInputElement) {
                updateCheckboxState($checkbox, hasChecked[iColumn], hasUnchecked[iColumn]);
            }
            const $count = $selector.querySelector('output');
            if ($count) {
                if (selectedChangesetIds[iColumn].size == 0) {
                    $count.replaceChildren();
                }
                else {
                    $count.replaceChildren(`${selectedChangesetIds[iColumn].size} selected`);
                }
            }
        }
        {
            const $checkbox = this.$selectorRow.querySelector(':scope > td:first-child input[type=checkbox]');
            if ($checkbox instanceof HTMLInputElement) {
                updateCheckboxState($checkbox, hasChecked.some(v => v), hasUnchecked.some(v => v));
            }
        }
    }
    async makeQueryUserEntry(query) {
        let info = await this.askDbForUserInfo(query);
        if (!info) {
            this.sendUserQueryToWorker(query);
            info = { status: 'pending' };
        }
        const $tab = makeUserTab(this.wrappedRemoveColumnClickListener, query);
        const $displayedChangesetsCount = this.makeUserDisplayedItemsCount();
        const $displayedNotesCount = this.makeUserDisplayedItemsCount();
        const $card = makeUserCard(this.colorizer, $displayedChangesetsCount, $displayedNotesCount, () => this.sendUserQueryToWorker(query), (type, uid) => this.sendRescanRequestToWorker(type, uid), (uid) => {
            this.changeUidHuePickerValue(uid);
            this.changeUidHue(uid);
        });
        this.updateUserCard($card, info);
        const $selector = makeUserSelector($checkbox => {
            for (const [iColumn, userEntry] of this.userEntries.entries()) {
                if ($selector != userEntry.$selector)
                    continue;
                this.triggerColumnCheckboxes(iColumn, $checkbox.checked);
            }
        });
        return {
            $tab, $card, $selector,
            type: 'query',
            query, info,
            $displayedChangesetsCount, displayedChangesetsCount: 0,
            $displayedNotesCount, displayedNotesCount: 0,
        };
    }
    updateUserCard($card, info) {
        updateUserCard(this.colorizer, $card, info, name => this.cx.server.web.getUrl(e$1 `user/${name}`), id => this.cx.server.api.getUrl(e$1 `user/${id}.json`));
    }
    makeFormUserEntry() {
        const userEntry = {
            $tab: makeFormTab(this.wrappedRemoveColumnClickListener),
            $card: makeFormCard(value => {
                return toUserQuery(this.cx.server.api, this.cx.server.web, value);
            }, async (query) => {
                const newUserEntry = await this.makeQueryUserEntry(query);
                // userEntry.$tab.replaceWith($newTab)
                // userEntry.$card.replaceWith($newCard)
                Object.assign(userEntry, newUserEntry);
                this.rewriteUserEntriesInHead();
                this.sendUpdatedUserQueries();
                this.restartStream();
            }),
            $selector: makeFormSelector(),
            type: 'form'
        };
        return userEntry;
    }
    async askDbForUserInfo(query) {
        if (query.type == 'name') {
            const info = await this.db.getUserInfoByName(query.username);
            if (info)
                return { status: 'ready', ...info };
        }
        else if (query.type == 'id') {
            const info = await this.db.getUserInfoById(query.uid);
            if (info)
                return { status: 'ready', ...info };
        }
    }
    pickFromExistingUserEntries(query) {
        for (const [i, entry] of this.userEntries.entries()) {
            if (entry.type != 'query')
                continue;
            if (isSameQuery(query, entry.query)) {
                this.userEntries.splice(i, 1);
                return entry;
            }
        }
        return null;
    }
    restartStream() {
        for (const entry of this.userEntries) {
            if (entry.type != 'query')
                continue;
            entry.$displayedChangesetsCount.textContent = String(entry.displayedChangesetsCount = 0);
            entry.$displayedNotesCount.textContent = String(entry.displayedNotesCount = 0);
        }
        const columnUids = this.userEntries.map(getUserEntryUid);
        this.setColumns(columnUids);
        this.streamMessenger = undefined;
        this.restartStreamCallback();
        this.startStreamIfNotStartedAndGotAllUids();
    }
    startStreamIfNotStartedAndGotAllUids() {
        if (this.streamMessenger)
            return;
        const users = new Map();
        const columnUids = [];
        for (const entry of this.userEntries) {
            if (entry.type != 'query' || entry.info.status == 'failed') {
                columnUids.push(undefined);
            }
            else if (entry.info.status == 'ready') {
                users.set(entry.info.user.id, entry.info.user);
                columnUids.push(entry.info.user.id);
            }
            else {
                return;
            }
        }
        this.setColumns(columnUids);
        const stream = new MuxUserItemDbStream(this.db, [...users.values()]);
        const streamMessenger = new MuxUserItemDbStreamMessenger(this.cx.server.host, this.worker, stream, columnUids, (batch, usernames) => {
            for (const { iColumns, type } of batch) {
                for (const iColumn of iColumns) {
                    const userEntry = this.userEntries[iColumn];
                    if (!userEntry || userEntry.type != 'query')
                        continue;
                    if (type == 'changeset') {
                        userEntry.$displayedChangesetsCount.textContent = String(++userEntry.displayedChangesetsCount);
                    }
                    else if (type == 'note') {
                        userEntry.$displayedNotesCount.textContent = String(++userEntry.displayedNotesCount);
                    }
                }
            }
            this.receiveBatchCallback(batch, usernames);
            this.updateSelectors();
        });
        this.readyStreamCallback(async () => {
            await streamMessenger.requestNextBatch();
        });
        this.streamMessenger = streamMessenger;
    }
    makeUserDisplayedItemsCount() {
        const $count = makeElement('output')()(`???`);
        $count.title = `displayed`;
        return $count;
    }
    removeColumnClickListener($button) {
        const $tab = $button.closest('.tab');
        for (const [i, entry] of this.userEntries.entries()) {
            if (entry.$tab != $tab)
                continue;
            this.userEntries.splice(i, 1);
            // entry.$tab.remove() // TODO rewrite
            // entry.$card.remove()
            this.rewriteUserEntriesInHead();
            this.sendUpdatedUserQueries();
            this.restartStream();
            break;
        }
    }
    sendUpdatedUserQueries() {
        this.sendUpdatedUserQueriesReceiver(this.userEntries.flatMap(entry => entry.type == 'query' ? [entry.query] : []));
    }
    sendUserQueryToWorker(query) {
        this.worker.port.postMessage({
            type: 'getUserInfo',
            host: this.cx.server.host,
            query
        });
    }
    sendRescanRequestToWorker(type, uid) {
        this.worker.port.postMessage({
            type: 'scanUserItems',
            host: this.cx.server.host,
            start: true,
            itemType: type,
            uid: uid,
        });
    }
    // private appendUserEntryToHead(userEntry: GridUserEntry): void {
    // 	this.$tabRow.append(userEntry.$tab) // TODO make table cells
    // 	this.$adderCell.before(userEntry.$card)
    // }
    rewriteUserEntriesInHead() {
        const $allTabCell = makeElement('th')('all')(makeAllTab());
        writeHueAttributes(this.colorizer, $allTabCell, undefined);
        this.$tabRow.replaceChildren($allTabCell);
        const $allCardCell = makeElement('td')('all')();
        writeHueAttributes(this.colorizer, $allCardCell, undefined);
        this.$cardRow.replaceChildren($allCardCell);
        const $allSelectorCell = makeElement('td')('all')(makeUserSelector($checkbox => {
            const checked = $checkbox.checked;
            for (const iColumn of this.userEntries.keys()) {
                this.triggerColumnCheckboxes(iColumn, checked);
            }
        }));
        writeHueAttributes(this.colorizer, $allSelectorCell, undefined);
        this.$selectorRow.replaceChildren($allSelectorCell);
        const gridHeadCells = [];
        for (const userEntry of this.userEntries) {
            const { $tab, $card, $selector } = userEntry;
            const $tabCell = makeElement('th')()($tab);
            const $cardCell = makeElement('td')()($card);
            const $selectorCell = makeElement('td')()($selector);
            const uid = getUserEntryUid(userEntry);
            writeHueAttributes(this.colorizer, $tabCell, uid);
            writeHueAttributes(this.colorizer, $cardCell, uid);
            writeHueAttributes(this.colorizer, $selectorCell, uid);
            this.$tabRow.append($tabCell);
            this.$cardRow.append($cardCell);
            this.$selectorRow.append($selectorCell);
            gridHeadCells.push({ $tabCell, $cardCell, $selectorCell });
        }
        for (const [iActive, { $tab }] of this.userEntries.entries()) {
            new TabDragListener(this.$gridHead, gridHeadCells, $tab, iActive, iShiftTo => {
                moveInArray(this.userEntries, iActive, iShiftTo);
                this.rewriteUserEntriesInHead();
                this.sendUpdatedUserQueries();
                this.reorderColumns(iActive, iShiftTo);
                this.streamMessenger?.reorderColumns(iActive, iShiftTo);
            }).install();
        }
        this.$tabRow.append(this.$adderCell);
    }
    changeUidHuePickerValue(uid) {
        for (const userEntry of this.userEntries) {
            if (userEntry.type != 'query')
                continue;
            if (userEntry.info.status != 'ready' && userEntry.info.status != 'rerunning')
                continue;
            if (userEntry.info.user.id != uid)
                continue;
            this.updateUserCard(userEntry.$card, userEntry.info);
        }
    }
}
function isSameQuery(query1, query2) {
    if (query1.type == 'id') {
        if (query2.type != query1.type)
            return false;
        return query1.uid == query2.uid;
    }
    else if (query1.type == 'name') {
        if (query2.type != query1.type)
            return false;
        return query1.username == query2.username;
    }
    else {
        return false;
    }
}
function getUserEntryUid(userEntry) {
    return (userEntry.type == 'query' && (userEntry.info.status == 'ready' || userEntry.info.status == 'rerunning')
        ? userEntry.info.user.id
        : undefined);
}

class ItemRow {
    constructor($row) {
        this.$row = $row;
    }
    isEmpty() {
        return !this.$row.querySelector(':scope > td > * > .item');
    }
    get isStretched() {
        const $stretchCell = this.$row.cells[0];
        return $stretchCell.colSpan > 1;
    }
    getBoundarySequencePoints() {
        let greaterPoint = null;
        let lesserPoint = null;
        for (const $cell of this.$row.cells) {
            const [$container] = $cell.children;
            if (!($container instanceof HTMLElement))
                continue;
            for (const $item of $container.children) {
                if (!isItem($item))
                    continue;
                const point = readItemSequencePoint($item);
                if (!point)
                    continue;
                if (!greaterPoint || isGreaterElementSequencePoint(point, greaterPoint)) {
                    greaterPoint = point;
                }
                if (!lesserPoint || isGreaterElementSequencePoint(lesserPoint, point)) {
                    lesserPoint = point;
                }
            }
        }
        return [greaterPoint, lesserPoint];
    }
    *getItemSequence() {
        const nRawColumns = this.$row.cells.length;
        if (nRawColumns == 0)
            return;
        const iRawColumnPositions = Array(nRawColumns).fill(0);
        while (true) {
            let point;
            let rawItems = [];
            for (const [iRawColumn, $cell] of [...this.$row.cells].entries()) {
                const [$container] = $cell.children;
                if (!($container instanceof HTMLElement))
                    continue;
                let $item;
                let columnPoint = null;
                for (; iRawColumnPositions[iRawColumn] < $container.children.length; iRawColumnPositions[iRawColumn]++) {
                    $item = $container.children[iRawColumnPositions[iRawColumn]];
                    if (!isItem($item))
                        continue;
                    columnPoint = readItemSequencePoint($item);
                    if (!columnPoint)
                        continue;
                    break;
                }
                if (iRawColumnPositions[iRawColumn] >= $container.children.length)
                    continue;
                if (!$item || !isItem($item) || !columnPoint)
                    continue;
                if (point && isGreaterElementSequencePoint(point, columnPoint))
                    continue;
                if (!point || isGreaterElementSequencePoint(columnPoint, point)) {
                    point = columnPoint;
                    rawItems = [[iRawColumn, $item]];
                }
                else {
                    rawItems.push([iRawColumn, $item]);
                }
            }
            if (!point)
                break;
            for (const [iRawColumn] of rawItems) {
                iRawColumnPositions[iRawColumn]++;
            }
            const items = rawItems.map(([iRawColumn, $item]) => [
                iRawColumn == 0 ? Number($item.dataset.column) : iRawColumn - 1,
                $item
            ]);
            yield [point, items];
        }
    }
    put(iColumns, $items) {
        for (const [iItem, iColumn] of iColumns.entries()) {
            const $cell = this.$row.cells[iColumn + 1];
            const $item = $items[iItem];
            $cell.replaceChildren(makeDiv()($item));
        }
    }
    stretch() {
        if (this.isStretched)
            return;
        const nTotalColumns = this.$row.cells.length + 1;
        const itemSequence = [...this.getItemSequence()];
        const $stretchCell = this.$row.cells[0];
        $stretchCell.colSpan = nTotalColumns;
        for (const [iRawColumn, $cell] of [...this.$row.cells].entries()) {
            if (iRawColumn == 0)
                continue;
            $cell.hidden = true;
        }
        const $stretchContainer = getCellContainer($stretchCell);
        for (const [, items] of itemSequence) {
            const [[iColumn, $item]] = items;
            $item.dataset.column = String(iColumn);
            appendToContainer($stretchContainer, $item);
        }
    }
    shrink() {
        if (!this.isStretched)
            return;
        const $stretchCell = this.$row.cells[0];
        $stretchCell.removeAttribute('colspan');
        for (const [iRawColumn, $cell] of [...this.$row.cells].entries()) {
            if (iRawColumn == 0)
                continue;
            $cell.hidden = false;
        }
        const [$stretchContainer] = $stretchCell.children;
        if (!($stretchContainer instanceof HTMLElement))
            return;
        for (const $item of $stretchContainer.querySelectorAll(':scope > .item')) {
            if (!($item instanceof HTMLElement))
                continue;
            const iColumn = Number($item.dataset.column);
            const $targetCell = this.$row.cells[iColumn + 1];
            if (!($targetCell instanceof HTMLTableCellElement))
                continue;
            const $targetContainer = getCellContainer($targetCell);
            appendToContainer($targetContainer, $item);
        }
        $stretchContainer.replaceChildren();
    }
    reorderColumns(iShiftFrom, iShiftTo) {
        const $cells = [...this.$row.cells];
        moveInArray($cells, iShiftFrom + 1, iShiftTo + 1);
        this.$row.replaceChildren(...$cells);
        const nColumns = this.$row.cells.length - 1;
        const iMap = Array(nColumns).fill(0).map((_, i) => i);
        moveInArray(iMap, iShiftTo, iShiftFrom);
        const $stretchCell = this.$row.cells[0];
        for (const $item of $stretchCell.querySelectorAll(':scope > * > .item')) {
            if (!($item instanceof HTMLElement))
                continue;
            const iColumn = Number($item.dataset.column);
            if (iMap[iColumn] != null) {
                $item.dataset.column = String(iMap[iColumn]);
            }
        }
    }
}
function getCellContainer($cell) {
    const [$existingContainer] = $cell.children;
    if ($existingContainer instanceof HTMLElement) {
        return $existingContainer;
    }
    const $newContainer = makeDiv()();
    $cell.append($newContainer);
    return $newContainer;
}
function appendToContainer($container, $item) {
    if ($container.children.length > 0) {
        $container.append(` `);
    }
    $container.append($item);
}

class ItemCollectionRow extends ItemRow {
    constructor($row) {
        super($row);
    }
    /**
     * Split collection into two rows at the given sequence point
     *
     * @returns new row with collection items lesser than the sequence point
     */
    split(sequencePoint) {
        const $splitRow = makeElement('tr')('collection')();
        for (const $cell of this.$row.cells) {
            const $splitCell = $splitRow.insertCell();
            const style = $cell.getAttribute('style');
            if (style) {
                $splitCell.setAttribute('style', style);
            }
            if ($cell.dataset.hueUid) {
                $splitCell.dataset.hueUid = $cell.dataset.hueUid;
            }
            const [$container] = $cell.children;
            const $splitContainer = makeDiv()();
            $splitCell.append($splitContainer);
            let startedMoving = false;
            let nItems = 0;
            const $itemsToMove = [];
            if ($container instanceof HTMLElement) {
                for (const $item of $container.children) {
                    if (!isItem($item))
                        continue;
                    nItems++;
                    if (!startedMoving) {
                        const collectionItemSequencePoint = readItemSequencePoint($item);
                        if (!collectionItemSequencePoint)
                            continue;
                        if (isGreaterElementSequencePoint(sequencePoint, collectionItemSequencePoint)) {
                            startedMoving = true;
                        }
                    }
                    if (startedMoving) {
                        $itemsToMove.push($item);
                    }
                }
                if ($itemsToMove.length > 0) {
                    $splitContainer.append(makeCollectionIcon());
                }
                for (const $item of $itemsToMove) {
                    removeInlineElement($item);
                    $splitContainer.append(` `, $item);
                }
                if (nItems <= $itemsToMove.length) {
                    const $icon = $container.children[0];
                    if ($icon && $icon.classList.contains('icon')) {
                        $icon.remove();
                    }
                }
            }
            if ($cell.classList.contains('with-timeline-below')) {
                $splitCell.classList.add('with-timeline-above');
                $splitCell.classList.add('with-timeline-below');
            }
            if ($cell.classList.contains('with-timeline-above') && $itemsToMove.length > 0) {
                $cell.classList.add('with-timeline-below');
                $splitCell.classList.add('with-timeline-above');
            }
            if ($cell.colSpan > 1) {
                $splitCell.colSpan = $cell.colSpan;
            }
            if ($cell.hidden) {
                $splitCell.hidden = true;
            }
        }
        return new ItemCollectionRow($splitRow);
    }
    merge(that) {
        if (this.isStretched && !that.isStretched) {
            that.stretch();
        }
        else if (!this.isStretched && that.isStretched) {
            this.stretch();
        }
        const copyChildren = ($container1, $container2) => {
            let copying = false;
            for (const $child of [...$container2.children]) {
                if ($child.classList.contains('item')) {
                    copying = true;
                    if ($container1.children.length == 0) {
                        $container1.append(makeCollectionIcon());
                    }
                }
                if (copying) {
                    $container1.append($child);
                    $child.before(' ');
                }
            }
        };
        const $cells1 = [...this.$row.cells];
        const $cells2 = [...that.$row.cells];
        for (let i = 0; i < $cells1.length && i < $cells2.length; i++) {
            const $cell1 = $cells1[i];
            const $cell2 = $cells2[i];
            if (!$cell2)
                continue;
            if (!$cell1) {
                this.$row.append($cell2);
                continue;
            }
            const [$container1] = $cell1.children;
            const [$container2] = $cell2.children;
            if ($container2 instanceof HTMLElement) {
                if ($container1 instanceof HTMLElement) {
                    copyChildren($container1, $container2);
                }
                else {
                    $cell1.append($container2);
                }
            }
            $cell1.classList.toggle('with-timeline-below', $cell2.classList.contains('with-timeline-below'));
        }
    }
    /**
     * Insert items, adding cell icons if they were missing
     */
    insert(sequencePoint, iColumns, $items) {
        itemLoop: for (let iItem = 0; iItem < iColumns.length; iItem++) {
            const $item = $items[iItem];
            const iColumn = iColumns[iItem];
            let $cell;
            if (this.isStretched && iItem == 0) {
                $cell = this.$row.cells[0];
                $item.dataset.column = String(iColumn);
            }
            else {
                $cell = this.$row.cells[iColumn + 1];
            }
            let [$container] = $cell.children;
            if (!($container instanceof HTMLElement)) {
                $cell.append($container = makeDiv()());
            }
            let nItems = 0;
            for (const $existingItem of $container.children) {
                if (!isItem($existingItem))
                    continue;
                nItems++;
                const collectionItemSequencePoint = readItemSequencePoint($existingItem);
                if (!collectionItemSequencePoint)
                    continue;
                if (isGreaterElementSequencePoint(sequencePoint, collectionItemSequencePoint)) {
                    $existingItem.before($item, ` `);
                    continue itemLoop;
                }
            }
            if (nItems == 0) {
                const $icon = makeCollectionIcon();
                $container.prepend($icon);
                $icon.after(` `, $item);
            }
            else {
                const $lastChild = $container.lastElementChild;
                $lastChild.after(` `, $item);
            }
        }
    }
    remove($items) {
        for (const $item of $items) {
            const $container = $item.parentElement;
            if (!($container instanceof HTMLElement))
                continue;
            const $cell = $container.parentElement;
            if (!($cell instanceof HTMLTableCellElement))
                continue;
            if ($cell.parentElement != this.$row)
                continue;
            removeInlineElement($item);
            if ($container.querySelector(':scope > .item'))
                continue;
            $container.replaceChildren();
        }
    }
    stretch() {
        super.stretch();
        this.fixCollectionIcons();
    }
    shrink() {
        super.shrink();
        this.fixCollectionIcons();
    }
    fixCollectionIcons() {
        for (const $cell of this.$row.cells) {
            const $container = $cell.firstElementChild;
            if (!($container instanceof HTMLElement))
                continue;
            if (!$container.querySelector(':scope > .item')) {
                $container.replaceChildren();
            }
            else {
                const $firstChild = $container.firstElementChild;
                if (!($firstChild instanceof HTMLElement))
                    return;
                if ($firstChild.classList.contains('icon'))
                    return;
                $container.prepend(makeCollectionIcon(), ` `);
            }
        }
    }
}

class EmbeddedItemRow {
    constructor(row) {
        if (row instanceof ItemRow) {
            this.row = row;
        }
        else if (row.classList.contains('collection')) {
            this.row = new ItemCollectionRow(row);
        }
        else {
            this.row = new ItemRow(row);
        }
    }
    static fromEmptyRow($row, className, colorizer, columnUids) {
        $row.classList.add(className);
        const $allCell = $row.insertCell();
        writeHueAttributes(colorizer, $allCell, undefined);
        for (const uid of columnUids) {
            const $cell = $row.insertCell();
            writeHueAttributes(colorizer, $cell, uid);
        }
        const embeddedRow = new EmbeddedItemRow($row);
        embeddedRow.addStretchButton();
        return embeddedRow;
    }
    static isItemRow($row) {
        return ($row.classList.contains('single') ||
            $row.classList.contains('collection'));
    }
    get isStretched() {
        return this.row.isStretched;
    }
    getBoundarySequencePoints() {
        return this.row.getBoundarySequencePoints();
    }
    paste($row, sequencePoint, withAbbreviatedIds, withAbbreviatedComments) {
        this.removeStretchButton();
        this.row.$row.after($row);
        if (!(this.row instanceof ItemCollectionRow))
            return;
        const splitRow = this.row.split(sequencePoint);
        $row.after(splitRow.$row);
        const splitEmbeddedRow = new EmbeddedItemRow(splitRow);
        splitEmbeddedRow.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
        this.addStretchButton();
        splitEmbeddedRow.addStretchButton();
    }
    cut(withAbbreviatedIds, withAbbreviatedComments) {
        const $row = this.row.$row;
        const $prevRow = $row.previousElementSibling;
        const $nextRow = $row.nextElementSibling;
        $row.remove();
        if ($prevRow && $prevRow instanceof HTMLTableRowElement &&
            $nextRow && $nextRow instanceof HTMLTableRowElement) {
            const prevEmbeddedRow = new EmbeddedItemRow($prevRow);
            const nextEmbeddedRow = new EmbeddedItemRow($nextRow);
            if (prevEmbeddedRow.row instanceof ItemCollectionRow &&
                nextEmbeddedRow.row instanceof ItemCollectionRow) {
                prevEmbeddedRow.removeStretchButton();
                nextEmbeddedRow.removeStretchButton();
                prevEmbeddedRow.row.merge(nextEmbeddedRow.row);
                nextEmbeddedRow.row.$row.remove();
                prevEmbeddedRow.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
                prevEmbeddedRow.addStretchButton();
            }
        }
    }
    put(iColumns, $items) {
        this.row.put(iColumns, $items);
    }
    insert(sequencePoint, iColumns, $items, withAbbreviatedIds, withAbbreviatedComments) {
        if (!(this.row instanceof ItemCollectionRow))
            throw new TypeError(`attempt to insert into non-collection row`);
        this.removeStretchButton();
        this.row.insert(sequencePoint, iColumns, $items);
        this.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
        this.addStretchButton();
    }
    remove($items, withAbbreviatedIds, withAbbreviatedComments) {
        if (!(this.row instanceof ItemCollectionRow))
            throw new TypeError(`attempt to remove from non-collection row`);
        this.removeStretchButton();
        this.row.remove($items);
        if (this.row.isEmpty()) {
            this.row.$row.remove();
        }
        else {
            this.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
        }
        this.addStretchButton();
    }
    stretch(withAbbreviatedIds, withAbbreviatedComments) {
        this.removeStretchButton();
        this.row.stretch();
        this.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
        this.addStretchButton();
    }
    shrink(withAbbreviatedIds, withAbbreviatedComments) {
        this.removeStretchButton();
        this.row.shrink();
        this.updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments);
        this.addStretchButton();
    }
    updateAbbreviations(withAbbreviatedIds, withAbbreviatedComments) {
        const startAbbreviator = (withAbbreviation, getValue, setLongValue, setShortValue) => {
            let lastValue = '';
            return ($item, $piece) => {
                if (!($piece instanceof HTMLElement)) {
                    lastValue = '';
                    return;
                }
                if ($piece.hidden)
                    return;
                const value = getValue($item, $piece);
                if (value == null) {
                    lastValue = '';
                    return;
                }
                let compacted = false;
                if (withAbbreviation && value.length == lastValue.length) {
                    let shortValue = '';
                    for (let i = 0; i < value.length; i++) {
                        if (value[i] == lastValue[i])
                            continue;
                        shortValue = value.substring(i);
                        break;
                    }
                    if (value.length - shortValue.length > 2) {
                        setShortValue($piece, value, shortValue);
                        compacted = true;
                    }
                }
                if (!compacted) {
                    setLongValue($piece, value);
                }
                lastValue = value;
            };
        };
        for (const $cell of this.row.$row.cells) {
            const idAbbreviator = startAbbreviator(withAbbreviatedIds, $item => $item.dataset.id ?? null, ($piece, value) => {
                $piece.textContent = value;
                $piece.removeAttribute('title');
            }, ($piece, value, shortValue) => {
                $piece.textContent = '...' + shortValue;
                $piece.title = value;
            });
            const commentAbbreviator = startAbbreviator(withAbbreviatedComments, (_, $piece) => readCollapsedItemCommentPieceText($piece), ($piece, value) => writeCollapsedItemCommentPieceText($piece, value), ($piece, value, shortValue) => writeCollapsedItemCommentPieceText($piece, value, shortValue));
            for (const $item of $cell.querySelectorAll(':scope > * > .item')) {
                if (!isItem($item))
                    continue;
                if ($item.hidden)
                    continue;
                idAbbreviator($item, $item.querySelector(':scope > .balloon > .flow > a[data-optional="id"]'));
                commentAbbreviator($item, $item.querySelector(':scope > .balloon > .flow > [data-optional="comment"]'));
            }
        }
    }
    updateStretchButtonHiddenState() {
        const $button = this.row.$row.querySelector(':scope > :first-child > * > button.stretch');
        if (!($button instanceof HTMLButtonElement))
            return;
        $button.hidden = !this.row.$row.querySelector('.item:not([hidden])');
    }
    *getItemSequence() {
        yield* this.row.getItemSequence();
    }
    reorderColumns(iShiftFrom, iShiftTo) {
        this.row.reorderColumns(iShiftFrom, iShiftTo);
    }
    removeStretchButton() {
        const $stretchButton = this.row.$row.querySelector(':scope > :first-child > * > button.stretch');
        if (!$stretchButton)
            return;
        removeInlineElement($stretchButton);
    }
    addStretchButton() {
        const $button = makeElement('button')('stretch')(this.isStretched ? `><` : `<>`);
        $button.title = this.isStretched ? `Show in multiple columns` : `Show in one stretched column`;
        const $stretchCell = this.row.$row.cells[0];
        const $stretchContainer = getCellContainer($stretchCell);
        if ($stretchContainer.hasChildNodes()) {
            $stretchContainer.append(` `);
        }
        $stretchContainer.append($button);
        this.updateStretchButtonHiddenState();
    }
}

/**
 * Sets with-timeline-* cell classes on a given and preceding rows
 *
 * Looks at row and cell classes
 */
function updateTimelineOnInsert($row, iColumns) {
    const iColumnSet = new Set(iColumns);
    const inInsertedTimeline = Array($row.cells.length).fill(false);
    let $rowBelow = $row;
    while ($rowBelow.nextElementSibling) {
        $rowBelow = $rowBelow.nextElementSibling;
        if (!isContentRow($rowBelow))
            continue;
        for (const [iRawColumn, $cellBelow] of [...$rowBelow.cells].entries()) {
            if (iRawColumn == 0)
                continue;
            const iColumn = iRawColumn - 1;
            if ($cellBelow.classList.contains('with-timeline-above')) {
                inInsertedTimeline[iColumn] = true;
            }
        }
        break;
    }
    for (const [iRawColumn, $cell] of [...$row.cells].entries()) {
        if (iRawColumn == 0)
            continue;
        const iColumn = iRawColumn - 1;
        if (inInsertedTimeline[iColumn]) {
            $cell.classList.add('with-timeline-below');
        }
        if (iColumnSet.has(iColumn) || $cell.classList.contains('with-timeline-above')) {
            inInsertedTimeline[iColumn] = true;
        }
        if (inInsertedTimeline[iColumn]) {
            $cell.classList.add('with-timeline-above');
        }
    }
    let $rowAbove = $row;
    while ($rowAbove.previousElementSibling && inInsertedTimeline.some(_ => _)) {
        $rowAbove = $rowAbove.previousElementSibling;
        if (!isContentRow($rowAbove))
            continue;
        for (const [iRawColumn, $cell] of [...$rowAbove.cells].entries()) {
            if (iRawColumn == 0)
                continue;
            const iColumn = iRawColumn - 1;
            if (!inInsertedTimeline[iColumn])
                continue;
            $cell.classList.add('with-timeline-below');
            if ($cell.classList.contains('with-timeline-above')) {
                inInsertedTimeline[iColumn] = false;
            }
            else {
                $cell.classList.add('with-timeline-above');
            }
        }
    }
}
function isContentRow($row) {
    return ($row instanceof HTMLTableRowElement &&
        ($row.classList.contains('single') || $row.classList.contains('collection')));
}

class GridBodyCheckboxHandler {
    constructor($gridBody) {
        this.$gridBody = $gridBody;
        this.onItemSelect = () => { };
        $gridBody.addEventListener('click', ev => {
            const $checkbox = ev.target;
            if (!($checkbox instanceof HTMLInputElement))
                return;
            if ($checkbox.type != 'checkbox')
                return;
            this.clickListener($checkbox, ev.shiftKey);
        });
    }
    resetLastClickedCheckbox() {
        this.$lastClickedCheckbox = undefined;
    }
    triggerColumnCheckboxes(iColumn, isChecked) {
        for (const $row of this.$gridBody.rows) {
            const targetChangesetIds = new Set();
            for (const [, changesetId] of listRowCellCheckboxes($row, iColumn)) {
                targetChangesetIds.add(changesetId);
            }
            for (const [$checkbox, changesetId] of listRowCheckboxes($row)) {
                if (!targetChangesetIds.has(changesetId))
                    continue;
                $checkbox.checked = isChecked;
            }
        }
        this.onItemSelect();
    }
    getColumnCheckboxStatuses(nColumns) {
        const hasChecked = Array(nColumns).fill(false);
        const hasUnchecked = Array(nColumns).fill(false);
        const selectedChangesetIds = [];
        for (let i = 0; i < nColumns; i++) {
            selectedChangesetIds.push(new Set());
        }
        for (const $row of this.$gridBody.rows) {
            for (const [$checkbox, changesetId, iColumn] of listRowCheckboxes($row)) {
                hasChecked[iColumn] || (hasChecked[iColumn] = $checkbox.checked);
                hasUnchecked[iColumn] || (hasUnchecked[iColumn] = !$checkbox.checked);
                if ($checkbox.checked) {
                    selectedChangesetIds[iColumn].add(changesetId);
                }
            }
        }
        return [hasChecked, hasUnchecked, selectedChangesetIds];
    }
    clickListener($clickedCheckbox, shiftKey) {
        const getRowsAndChangesetIdsOfClickedCheckbox = () => {
            const $row = $clickedCheckbox.closest('tr');
            const $item = $clickedCheckbox.closest('.item');
            if (!$row || !($item instanceof HTMLElement))
                return null;
            const descriptor = readItemDescriptor($item);
            if (!descriptor)
                return null;
            return [[$row, new Set([descriptor.id])]];
        };
        let rowsAndChangesetIds = null;
        if (shiftKey && this.$lastClickedCheckbox) {
            rowsAndChangesetIds = this.getRowsAndChangesetIdsBetweenEdgeCheckboxes(this.$lastClickedCheckbox, $clickedCheckbox);
        }
        this.$lastClickedCheckbox = $clickedCheckbox;
        if (!rowsAndChangesetIds) {
            rowsAndChangesetIds = getRowsAndChangesetIdsOfClickedCheckbox();
        }
        if (!rowsAndChangesetIds)
            return;
        const isChecked = $clickedCheckbox.checked;
        for (const [$row, changesetIds] of rowsAndChangesetIds) {
            for (const [$checkbox, changesetId] of listRowCheckboxes($row)) {
                if (!changesetIds.has(changesetId))
                    continue;
                $checkbox.checked = isChecked;
            }
        }
        this.onItemSelect();
    }
    getRowsAndChangesetIdsBetweenEdgeCheckboxes($checkbox1, $checkbox2) {
        const iColumn1 = getElementColumn($checkbox1);
        const iColumn2 = getElementColumn($checkbox2);
        if (iColumn1 == null || iColumn2 == null || iColumn1 != iColumn2)
            return null;
        const rowsAndChangesetIds = [];
        let insideRange = -1;
        const $edgeCheckboxes = [$checkbox1, $checkbox2];
        const testEdgeCheckboxes = ($checkbox) => {
            const i = $edgeCheckboxes.indexOf($checkbox);
            if (i < 0)
                return false;
            $edgeCheckboxes.splice(i, 1);
            return true;
        };
        for (const $row of this.$gridBody.rows) {
            const changesetIds = new Set();
            for (const [$checkbox, changesetId] of listRowCellCheckboxes($row, iColumn1)) {
                if (insideRange < 0 && testEdgeCheckboxes($checkbox))
                    insideRange++;
                if (insideRange == 0)
                    changesetIds.add(changesetId);
                if (insideRange == 0 && testEdgeCheckboxes($checkbox))
                    insideRange++;
                if (insideRange > 0)
                    break;
            }
            rowsAndChangesetIds.push([$row, changesetIds]);
            if (insideRange > 0)
                break;
        }
        if (insideRange <= 0)
            return null;
        return rowsAndChangesetIds;
    }
}
function getElementColumn($e) {
    const $row = $e.closest('tr');
    const $cell = $e.closest('td');
    if (!$row || !$cell)
        return null;
    const iRawColumn = [...$row.cells].indexOf($cell);
    if (iRawColumn < 0)
        return null;
    return iRawColumn - 1;
}
function* listRowCheckboxes($row, columnFilter = () => true) {
    if (!$row.classList.contains('single') && !$row.classList.contains('collection'))
        return;
    for (const [iRawColumn, $cell] of [...$row.cells].entries()) {
        for (const $changeset of $cell.querySelectorAll(':scope > * > .changeset')) {
            if (!($changeset instanceof HTMLElement))
                continue;
            let iColumn;
            if (iRawColumn == 0) {
                iColumn = Number($changeset.dataset.column);
                if (!Number.isInteger(iColumn))
                    continue;
            }
            else {
                iColumn = iRawColumn - 1;
            }
            if (!columnFilter(iColumn))
                continue;
            const descriptor = readItemDescriptor($changeset);
            if (!descriptor || descriptor.type != 'changeset')
                continue;
            const $checkbox = getItemCheckbox($changeset);
            if (!$checkbox)
                continue;
            yield [$checkbox, descriptor.id, iColumn];
        }
    }
}
function* listRowCellCheckboxes($row, iColumn) {
    yield* listRowCheckboxes($row, i => i == iColumn);
}

function makeItemTypes(spec) {
    const types = [];
    if (spec[0] != ' ')
        types.push('changeset');
    if (spec[1] != ' ')
        types.push('changesetComment');
    if (spec[2] != ' ')
        types.push('note');
    if (spec[3] != ' ')
        types.push('noteComment');
    if (spec[4] != ' ')
        types.push('user');
    if (spec[5] != ' ')
        types.push('abbreviate');
    return new Set(types);
}
class ItemOption {
    constructor(value, name, types, label, title) {
        this.name = name;
        this.types = types;
        this.label = label;
        this.title = title;
        this.abbreviate = false;
        this.changeset = value;
        this.changesetComment = value;
        this.note = value;
        this.noteComment = value;
        this.user = value;
    }
    hasType(type) {
        return this.types.has(type);
    }
    get itemTypes() {
        return [...this.types].filter(type => type != 'abbreviate');
    }
    get some() {
        return this.itemTypes.reduce((value, type) => value || this[type], false);
    }
    get all() {
        return this.itemTypes.reduce((value, type) => value && this[type], true);
    }
    set all(value) {
        this.changeset = value;
        this.changesetComment = value;
        this.note = value;
        this.noteComment = value;
        this.user = value;
    }
    get(type) {
        if (type == 'changeset' || type == 'changesetComment' || type == 'note' || type == 'noteComment' || type == 'user') {
            return this[type];
        }
        else if (type == 'changesetClose') {
            return this.changeset;
        }
        else {
            return this.all;
        }
    }
}
class ItemOptions {
    constructor(isExpanded) {
        this.options = new Map([
            new ItemOption(isExpanded, 'date', makeItemTypes('CcNnU '), '📅'),
            new ItemOption(true, 'id', makeItemTypes('CcNn a'), '#'),
            new ItemOption(isExpanded, 'api', makeItemTypes('CcNnU '), 'api'),
            new ItemOption(isExpanded, 'editor', makeItemTypes('C N   '), '🛠️'),
            new ItemOption(isExpanded, 'source', makeItemTypes('C     '), '[]'),
            new ItemOption(isExpanded, 'position', makeItemTypes('C N   '), '⌖'),
            new ItemOption(isExpanded, 'changes', makeItemTypes('C     '), '📝', 'changes count'),
            new ItemOption(isExpanded, 'refs', makeItemTypes('CcNn  '), '💬', 'comment references'),
            new ItemOption(isExpanded, 'comment', makeItemTypes('CcNn a'), '📣'),
            new ItemOption(true, 'status', makeItemTypes('    U '), '?', 'status'),
        ].map(option => [option.name, option]));
        this.allTypes = makeItemTypes('CcNnU ');
    }
    [Symbol.iterator]() {
        return this.options.values();
    }
    get(name) {
        return this.options.get(name);
    }
    map(fn) {
        return [...this].map(fn);
    }
}

function bubbleEvent($target, type) {
    return $target.dispatchEvent(new Event(type, { bubbles: true }));
}
function bubbleCustomEvent($target, type, detail) {
    return $target.dispatchEvent(new CustomEvent(type, {
        bubbles: true,
        detail
    }));
}

class GridBody {
    get withAbbreviatedIds() {
        return !!this.collapsedItemOptions.get('id')?.abbreviate;
    }
    get withAbbreviatedComments() {
        return !!this.collapsedItemOptions.get('comment')?.abbreviate;
    }
    constructor(colorizer, server, itemReader, resetMapViewReceiver, addItemToMapViewReceiver) {
        this.colorizer = colorizer;
        this.server = server;
        this.itemReader = itemReader;
        this.resetMapViewReceiver = resetMapViewReceiver;
        this.addItemToMapViewReceiver = addItemToMapViewReceiver;
        this.$gridBody = makeElement('tbody')()();
        this.withClosedChangesets = false;
        this.expandedItemOptions = new ItemOptions(true);
        this.collapsedItemOptions = new ItemOptions(false);
        this.checkboxHandler = new GridBodyCheckboxHandler(this.$gridBody);
        this.columnUids = [];
        const bubbleItemEvent = ($item, eventType) => {
            const descriptor = readItemDescriptor($item);
            if (descriptor) {
                const mainDescriptor = getMainItemDescriptor(descriptor);
                if (mainDescriptor) {
                    bubbleCustomEvent($item, eventType, mainDescriptor);
                }
            }
        };
        this.$gridBody.addEventListener('click', ev => {
            if (!(ev.target instanceof Element))
                return;
            const $a = ev.target.closest('a.listened');
            if ($a) {
                ev.preventDefault();
            }
            const $button = ev.target.closest('button');
            if ($button) {
                if ($button.classList.contains('disclosure')) {
                    this.toggleItemDisclosureWithButton($button);
                }
                else if ($button.classList.contains('ref')) {
                    this.pingMainItemFromRefButton($button);
                }
                else if ($button.classList.contains('comment-ref')) {
                    this.pingCommentItemFromRefButton($button);
                }
                else if ($button.classList.contains('arrow')) {
                    this.reverseCommentRefsWithButton($button);
                }
                else if ($button.classList.contains('stretch')) {
                    this.toggleRowStretchWithButton($button);
                }
                return;
            }
            const $item = ev.target.closest('.item');
            if ($item instanceof HTMLElement) {
                bubbleItemEvent($item, 'osmChangesetViewer:itemPing');
                this.highlightClickedItem($item);
                return;
            }
        });
        this.$gridBody.addEventListener('mousemove', ev => {
            if (!(ev.target instanceof Element))
                return;
            const $item = ev.target.closest('.item');
            if (!($item instanceof HTMLElement))
                return;
            if ($item.classList.contains('highlighted-by-click-and-fading')) {
                this.highlightClickedItem($item);
            }
        });
        this.$gridBody.addEventListener('transitionend', ev => {
            if (!(ev.target instanceof HTMLElement))
                return;
            const $item = ev.target.closest('.item');
            if (!($item instanceof HTMLElement))
                return;
            this.unhighlightClickedItem($item);
        });
        this.$gridBody.addEventListener('mouseenter', ev => {
            if (!(ev.target instanceof HTMLElement))
                return;
            if (ev.target.matches('.item')) {
                const $item = ev.target;
                const descriptor = readItemDescriptor($item);
                if (!descriptor)
                    return;
                bubbleItemEvent($item, 'osmChangesetViewer:itemHighlight');
                this.highlightHoveredItemDescriptor(descriptor);
            }
            else if (ev.target.matches('button.comment-ref')) {
                const $button = ev.target;
                const $item = $button.closest('.item');
                if (!($item instanceof HTMLElement))
                    return;
                const descriptor = readItemDescriptor($item);
                if (!descriptor)
                    return;
                const order = Number($button.dataset.order);
                if (Number.isInteger(order)) {
                    this.highlightHoveredItemDescriptor(descriptor, getCommentItemDescriptor(descriptor, order));
                }
                else {
                    this.highlightHoveredItemDescriptor(descriptor);
                }
            }
            else if (ev.target.matches('button.ref')) {
                const $button = ev.target;
                const $item = $button.closest('.item');
                if (!($item instanceof HTMLElement))
                    return;
                const descriptor = readItemDescriptor($item);
                if (!descriptor)
                    return;
                this.highlightHoveredItemDescriptor(descriptor, getMainItemDescriptor(descriptor));
            }
        }, true);
        this.$gridBody.addEventListener('mouseleave', ev => {
            if (!(ev.target instanceof HTMLElement))
                return;
            if (ev.target.matches('.item')) {
                const $item = ev.target;
                const descriptor = readItemDescriptor($item);
                if (!descriptor)
                    return;
                bubbleItemEvent($item, 'osmChangesetViewer:itemUnhighlight');
                this.unhighlightHoveredItemDescriptor(descriptor);
            }
            else if (ev.target.matches('button.ref, button.comment-ref')) {
                const $button = ev.target;
                const $item = $button.closest('.item');
                if (!($item instanceof HTMLElement))
                    return;
                const descriptor = readItemDescriptor($item);
                if (!descriptor)
                    return;
                this.highlightHoveredItemDescriptor(descriptor);
            }
        }, true);
    }
    get nColumns() {
        return this.columnUids.length;
    }
    get withTotalColumn() {
        return this.nColumns >= 2;
    }
    set onItemSelect(callback) {
        this.checkboxHandler.onItemSelect = callback;
    }
    setColumns(columnUids) {
        this.resetMapViewReceiver();
        this.columnUids = columnUids;
        this.$gridBody.replaceChildren();
        this.checkboxHandler.resetLastClickedCheckbox();
        this.checkboxHandler.onItemSelect();
    }
    addItem(batchItem, usernames, isExpanded) {
        const sequencePoint = getBatchItemSequencePoint(batchItem);
        if (!sequencePoint)
            return false;
        const $item = makeItemShell(this.colorizer, batchItem, isExpanded, usernames);
        writeElementSequencePoint($item, sequencePoint);
        const $flow = $item.querySelector('.flow');
        if (!($flow instanceof HTMLElement))
            return false;
        writeExpandedItemFlow(this.colorizer, this.server, $flow, batchItem, usernames, this.expandedItemOptions);
        if (batchItem.type == 'changeset' || batchItem.type == 'note') {
            const id = batchItem.item.id;
            const uid = batchItem.item.uid;
            if (batchItem.type == 'changeset' && batchItem.item.bbox) {
                this.addItemToMapViewReceiver({ type: 'changeset', id, uid,
                    weight: batchItem.item.changes.count,
                    ...batchItem.item.bbox
                });
            }
            else if (batchItem.type == 'note') {
                this.addItemToMapViewReceiver({ type: 'note', id, uid,
                    weight: 5,
                    lat: batchItem.item.lat,
                    lon: batchItem.item.lon
                });
            }
        }
        const $items = batchItem.iColumns.map(() => $item.cloneNode(true));
        return this.insertItem(batchItem.iColumns, sequencePoint, !isExpanded ? { isExpanded } : { isExpanded, batchItem, usernames }, $items);
    }
    stretchAllItems() {
        for (const $row of this.$gridBody.rows) {
            if (!EmbeddedItemRow.isItemRow($row))
                continue;
            const row = new EmbeddedItemRow($row);
            row.stretch(this.withAbbreviatedIds, this.withAbbreviatedComments);
        }
    }
    shrinkAllItems() {
        for (const $row of this.$gridBody.rows) {
            if (!EmbeddedItemRow.isItemRow($row))
                continue;
            const row = new EmbeddedItemRow($row);
            row.shrink(this.withAbbreviatedIds, this.withAbbreviatedComments);
        }
    }
    updateTableAfterItemInsertsOrOptionChanges() {
        this.combineChangesetsAccordingToSettings();
        this.updatePieceHiddenStatesAccordingToExpandedItemOptions();
        this.updatePieceHiddenStatesAccordingToCollapsedItemOptions();
        this.abbreviateAccordingToSettings();
    }
    updateTableAfterExpandedItemOptionChanges() {
        this.updatePieceHiddenStatesAccordingToExpandedItemOptions();
        this.abbreviateAccordingToSettings();
    }
    updateTableAfterCollapsedItemOptionChanges() {
        this.updatePieceHiddenStatesAccordingToCollapsedItemOptions();
        this.abbreviateAccordingToSettings();
    }
    updateTableAfterAbbreviationOptionChanges() {
        this.abbreviateAccordingToSettings();
    }
    combineChangesetsAccordingToSettings() {
        const setCheckboxTitle = ($item, title) => {
            const $checkbox = getItemCheckbox($item);
            if ($checkbox)
                $checkbox.title = title;
        };
        const combineChangesets = ($item, $laterItem) => {
            const isConnectedWithLaterItem = ($laterItem &&
                $laterItem.classList.contains('changeset') &&
                $laterItem.classList.contains('closed') &&
                $item.dataset.id == $laterItem.dataset.id);
            if ($item.classList.contains('changeset')) {
                if ($item.classList.contains('closed')) {
                    $item.hidden = !this.withClosedChangesets;
                }
                else {
                    const id = $item.dataset.id ?? '???';
                    if (isConnectedWithLaterItem || !this.withClosedChangesets) {
                        if ($laterItem && isConnectedWithLaterItem) {
                            $laterItem.hidden = true;
                        }
                        $item.classList.add('combined');
                        setCheckboxTitle($item, `changeset ${id}`);
                    }
                    else {
                        $item.classList.remove('combined');
                        setCheckboxTitle($item, `opened changeset ${id}`);
                    }
                }
            }
        };
        let $itemRowAbove;
        for (const $row of this.$gridBody.rows) {
            if ($row.classList.contains('collection')) {
                for (const $cell of $row.cells) {
                    let $laterItem;
                    for (const $item of $cell.querySelectorAll(':scope > * > .item')) {
                        if (!($item instanceof HTMLElement))
                            continue;
                        combineChangesets($item, $laterItem);
                        $laterItem = $item;
                    }
                }
                $itemRowAbove = undefined;
            }
            else if ($row.classList.contains('single')) {
                for (let i = 0; i < $row.cells.length; i++) {
                    const $cell = $row.cells[i];
                    const $item = $cell.querySelector(':scope > * > .item');
                    let $cellAbove;
                    if ($itemRowAbove) {
                        $cellAbove = $itemRowAbove.cells[i];
                    }
                    let $itemAbove;
                    if ($cellAbove) {
                        const $itemAboveCandidate = $cellAbove.querySelector(':scope > * > .item');
                        if ($itemAboveCandidate instanceof HTMLElement) {
                            $itemAbove = $itemAboveCandidate;
                        }
                    }
                    if ($item instanceof HTMLElement)
                        combineChangesets($item, $itemAbove);
                }
                $itemRowAbove = $row;
            }
            else {
                $itemRowAbove = undefined;
            }
        }
        for (const $row of this.$gridBody.rows) {
            if (!EmbeddedItemRow.isItemRow($row))
                continue;
            new EmbeddedItemRow($row).updateStretchButtonHiddenState();
        }
    }
    updatePieceHiddenStatesAccordingToExpandedItemOptions() {
        this.updatePieceHiddenStatesAccordingToItemOptions(this.expandedItemOptions, 'single');
    }
    updatePieceHiddenStatesAccordingToCollapsedItemOptions() {
        this.updatePieceHiddenStatesAccordingToItemOptions(this.collapsedItemOptions, 'collection');
        const hasSpaceBefore = ($e) => {
            const $s = $e.previousSibling;
            return $s?.nodeType == document.TEXT_NODE && $s.textContent == ' ';
        };
        for (const $flow of this.$gridBody.querySelectorAll(`:scope > tr.collection .item .balloon .flow`)) {
            let metVisiblePiece = false;
            for (const $piece of $flow.children) {
                if (!($piece instanceof HTMLElement))
                    continue;
                if (!$piece.hidden && metVisiblePiece) {
                    if (!hasSpaceBefore($piece)) {
                        $piece.before(' ');
                    }
                }
                else {
                    if (hasSpaceBefore($piece)) {
                        $piece.previousSibling?.remove();
                    }
                }
                metVisiblePiece || (metVisiblePiece = !$piece.hidden);
            }
        }
    }
    updatePieceHiddenStatesAccordingToItemOptions(itemOptions, rowClass) {
        for (const $item of this.$gridBody.querySelectorAll(`:scope > tr.${rowClass} .item`)) {
            if (!($item instanceof HTMLElement))
                continue;
            for (const itemOption of itemOptions) {
                const value = itemOption.get($item.dataset.type);
                for (const $piece of $item.querySelectorAll(`.flow [data-optional="${itemOption.name}"]`)) {
                    if (!($piece instanceof HTMLElement))
                        continue;
                    $piece.hidden = !value;
                }
            }
        }
    }
    abbreviateAccordingToSettings() {
        for (const $row of this.$gridBody.rows) {
            if ($row.classList.contains('collection')) {
                const row = new EmbeddedItemRow($row);
                row.updateAbbreviations(this.withAbbreviatedIds, this.withAbbreviatedComments);
            }
        }
    }
    reorderColumns(iShiftFrom, iShiftTo) {
        for (const $row of this.$gridBody.rows) {
            if (!EmbeddedItemRow.isItemRow($row))
                continue;
            new EmbeddedItemRow($row).reorderColumns(iShiftFrom, iShiftTo);
        }
    }
    getColumnCheckboxStatuses() {
        return this.checkboxHandler.getColumnCheckboxStatuses(this.nColumns);
    }
    listSelectedChangesetIds() {
        const [, , selectedChangesetIds] = this.checkboxHandler.getColumnCheckboxStatuses(this.nColumns);
        return union(selectedChangesetIds).values();
    }
    triggerColumnCheckboxes(iColumn, isChecked) {
        this.checkboxHandler.triggerColumnCheckboxes(iColumn, isChecked);
    }
    collapseItem(descriptor) {
        const collapseRowItems = ($row) => {
            const row = new EmbeddedItemRow($row);
            const itemSequence = [...row.getItemSequence()];
            if (itemSequence.length == 0)
                return;
            const [[sequencePoint, items]] = itemSequence;
            const iColumns = items.map(([iColumn]) => iColumn);
            const $items = items.map(([, $item]) => $item);
            row.cut(this.withAbbreviatedIds, this.withAbbreviatedComments);
            for (const $item of $items) {
                const $disclosureButton = getItemDisclosureButton($item);
                if ($disclosureButton) {
                    setDisclosureButtonState($disclosureButton, false);
                }
            }
            this.insertItem(iColumns, sequencePoint, { isExpanded: false }, $items);
        };
        const $rows = this.findRowsMatchingClassAndItemDescriptor('single', descriptor);
        for (const $row of $rows) {
            let $precedingRow = $row.previousElementSibling;
            const $precedingHiddenRows = [];
            while ($precedingRow instanceof HTMLTableRowElement) {
                const $precedingItem = getSingleRowLeadingItem($precedingRow);
                if (!$precedingItem || !isHiddenItem($precedingItem))
                    break;
                $precedingHiddenRows.push($precedingRow);
                $precedingRow = $precedingRow.previousElementSibling;
            }
            if ($precedingRow?.classList.contains('collection')) {
                for (const $row of $precedingHiddenRows) {
                    collapseRowItems($row);
                }
            }
            else {
                const $item = getSingleRowLeadingItem($row);
                if ($item && $item.classList.contains('combined')) {
                    const $previousRow = $row.previousElementSibling;
                    if ($previousRow instanceof HTMLTableRowElement) {
                        const $previousItem = getSingleRowLeadingItem($previousRow);
                        if ($previousItem &&
                            isHiddenItem($previousItem) &&
                            isChangesetOpenedClosedPair($item, $previousItem)) {
                            collapseRowItems($previousRow);
                        }
                    }
                }
            }
            let $followingRow = $row.nextElementSibling;
            const $followingHiddenRows = [];
            while ($followingRow instanceof HTMLTableRowElement) {
                const $followingItem = getSingleRowLeadingItem($followingRow);
                if (!$followingItem || !isHiddenItem($followingItem))
                    break;
                $followingHiddenRows.push($followingRow);
                $followingRow = $followingRow.nextElementSibling;
            }
            if ($followingRow?.classList.contains('collection')) {
                for (const $row of $followingHiddenRows) {
                    collapseRowItems($row);
                }
            }
            collapseRowItems($row);
        }
    }
    async expandItem(descriptor) {
        var _a;
        const $rows = this.findRowsMatchingClassAndItemDescriptor('collection', descriptor);
        for (const $row of $rows) {
            const row = new EmbeddedItemRow($row);
            const itemSequence = [...row.getItemSequence()];
            const isEverythingBetweenTargetPositionsHidden = [true];
            for (const [point, columnItems] of itemSequence) {
                if (isEqualItemDescriptor(descriptor, point)) {
                    isEverythingBetweenTargetPositionsHidden.push(true);
                }
                else {
                    isEverythingBetweenTargetPositionsHidden[_a = isEverythingBetweenTargetPositionsHidden.length - 1] && (isEverythingBetweenTargetPositionsHidden[_a] = columnItems.every(([, $item]) => isHiddenItem($item)));
                }
            }
            if (isEverythingBetweenTargetPositionsHidden.length <= 1)
                continue;
            let iTarget = 0;
            for (const [iPosition, [point, columnItems]] of itemSequence.entries()) {
                if (isEqualItemDescriptor(descriptor, point)) {
                    if (!isEverythingBetweenTargetPositionsHidden[iTarget]) {
                        const [previousPoint, previousColumnItems] = itemSequence[iPosition - 1];
                        if (isOpenedClosedPair(point, previousPoint)) {
                            await this.expandItemRow(previousPoint, previousColumnItems);
                        }
                    }
                    await this.expandItemRow(point, columnItems);
                    iTarget++;
                }
                else {
                    if (isEverythingBetweenTargetPositionsHidden[iTarget]) {
                        await this.expandItemRow(point, columnItems);
                    }
                }
            }
        }
    }
    async expandItemRow(point, items) {
        const makeUsernames = (uid, username) => {
            if (uid == null || username == null) {
                return new Map();
            }
            else {
                return new Map([[uid, username]]);
            }
        };
        const [[, $item]] = items;
        const $row = $item.closest('tr');
        if (!$row)
            return;
        let batchItem;
        let usernames;
        if (point.type == 'user') {
            const item = await this.itemReader.getUser(point.id);
            if (!item || !item.withDetails || !item.visible)
                return;
            batchItem = { type: point.type, item };
            usernames = makeUsernames();
        }
        else if (point.type == 'changeset' || point.type == 'changesetClose') {
            const item = await this.itemReader.getChangeset(point.id);
            if (!item)
                return;
            batchItem = { type: point.type, item };
            usernames = makeUsernames();
        }
        else if (point.type == 'note') {
            const item = await this.itemReader.getNote(point.id);
            if (!item)
                return;
            batchItem = { type: point.type, item };
            usernames = makeUsernames();
        }
        else if (point.type == 'changesetComment') {
            const { comment, username } = await this.itemReader.getChangesetComment(point.id, point.order ?? 0);
            if (!comment)
                return;
            batchItem = { type: point.type, item: comment };
            usernames = makeUsernames(comment.uid, username);
        }
        else if (point.type == 'noteComment') {
            const { comment, username } = await this.itemReader.getNoteComment(point.id, point.order ?? 0);
            if (!comment)
                return;
            batchItem = { type: point.type, item: comment };
            usernames = makeUsernames(comment.uid, username);
        }
        else {
            return;
        }
        const $items = items.map(([, $item]) => $item);
        for (const $item of $items) {
            const $disclosureButton = getItemDisclosureButton($item);
            if ($disclosureButton) {
                setDisclosureButtonState($disclosureButton, true);
            }
        }
        const row = new EmbeddedItemRow($row);
        row.remove($items, this.withAbbreviatedIds, this.withAbbreviatedComments);
        const iColumns = items.map(([iColumn]) => iColumn);
        this.insertItem(iColumns, point, { isExpanded: true, batchItem, usernames }, $items);
    }
    insertItem(iColumns, sequencePoint, insertItemInfo, $items) {
        if (iColumns.length == 0)
            return false;
        this.insertItemElements(iColumns, sequencePoint, insertItemInfo.isExpanded, $items);
        for (const $item of $items) {
            const $flow = $item.querySelector('.flow');
            if (!($flow instanceof HTMLElement))
                continue;
            if (insertItemInfo.isExpanded) {
                $flow.replaceChildren(); // TODO don't replaceChildren() in flow writers
                writeExpandedItemFlow(this.colorizer, this.server, $flow, insertItemInfo.batchItem, insertItemInfo.usernames, this.expandedItemOptions);
            }
            else {
                trimToCollapsedItemFlow($flow, $item.dataset.type, this.collapsedItemOptions);
            }
        }
        return true;
    }
    insertItemElements(iColumns, sequencePoint, isExpanded, $items) {
        const insertionRowInfo = this.findInsertionRow(sequencePoint);
        if (isExpanded) {
            let needStretch = false;
            const $row = makeElement('tr')()();
            if (insertionRowInfo.type == 'betweenRows') {
                insertionRowInfo.$rowBefore.after($row);
                if (EmbeddedItemRow.isItemRow(insertionRowInfo.$rowBefore)) {
                    needStretch || (needStretch = new EmbeddedItemRow(insertionRowInfo.$rowBefore).isStretched);
                }
                if (insertionRowInfo.$rowAfter &&
                    EmbeddedItemRow.isItemRow(insertionRowInfo.$rowAfter)) {
                    needStretch || (needStretch = new EmbeddedItemRow(insertionRowInfo.$rowAfter).isStretched);
                }
            }
            else {
                const insertionRow = new EmbeddedItemRow(insertionRowInfo.$row);
                insertionRow.paste($row, sequencePoint, this.withAbbreviatedIds, this.withAbbreviatedComments);
                needStretch = insertionRow.isStretched;
            }
            const row = EmbeddedItemRow.fromEmptyRow($row, 'single', this.colorizer, this.columnUids);
            updateTimelineOnInsert($row, iColumns);
            row.put(iColumns, $items);
            row.updateStretchButtonHiddenState();
            if (needStretch) {
                row.stretch(this.withAbbreviatedIds, this.withAbbreviatedComments);
            }
        }
        else {
            let $row;
            if (insertionRowInfo.type == 'betweenRows') {
                if (insertionRowInfo.$rowBefore.classList.contains('collection')) {
                    $row = insertionRowInfo.$rowBefore;
                }
                else if (insertionRowInfo.$rowAfter?.classList.contains('collection')) {
                    $row = insertionRowInfo.$rowAfter;
                }
                else {
                    $row = makeElement('tr')()();
                    insertionRowInfo.$rowBefore.after($row);
                    EmbeddedItemRow.fromEmptyRow($row, 'collection', this.colorizer, this.columnUids);
                }
            }
            else {
                $row = insertionRowInfo.$row;
            }
            updateTimelineOnInsert($row, iColumns);
            const row = new EmbeddedItemRow($row);
            row.insert(sequencePoint, iColumns, $items, this.withAbbreviatedIds, this.withAbbreviatedComments);
        }
    }
    findInsertionRow(sequencePoint) {
        for (let i = this.$gridBody.rows.length - 1; i >= 0; i--) {
            const $row = this.$gridBody.rows[i];
            const $rowAfter = this.$gridBody.rows[i + 1];
            if (EmbeddedItemRow.isItemRow($row)) {
                const row = new EmbeddedItemRow($row);
                const [greaterCollectionPoint, lesserCollectionPoint] = row.getBoundarySequencePoints();
                if (!greaterCollectionPoint || !lesserCollectionPoint)
                    continue;
                if (isGreaterElementSequencePoint(sequencePoint, greaterCollectionPoint))
                    continue;
                if (isGreaterElementSequencePoint(sequencePoint, lesserCollectionPoint)) {
                    return { type: 'insideRow', $row };
                }
                else if (isSameMonthTimestamps(sequencePoint.timestamp, lesserCollectionPoint.timestamp)) {
                    return { type: 'betweenRows', $rowBefore: $row, $rowAfter };
                }
                else {
                    const $separator = this.insertSeparatorRow(sequencePoint, $row);
                    return { type: 'betweenRows', $rowBefore: $separator, $rowAfter };
                }
            }
            else {
                const existingSequencePoint = readElementSequencePoint($row);
                if (!existingSequencePoint)
                    continue;
                if (!isGreaterElementSequencePoint(existingSequencePoint, sequencePoint))
                    continue;
                if (isSameMonthTimestamps(existingSequencePoint.timestamp, sequencePoint.timestamp)) {
                    return { type: 'betweenRows', $rowBefore: $row, $rowAfter };
                }
                else {
                    const $separator = this.insertSeparatorRow(sequencePoint, $row);
                    return { type: 'betweenRows', $rowBefore: $separator, $rowAfter };
                }
            }
        }
        {
            const $rowAfter = this.$gridBody.rows[0];
            const $separator = this.insertSeparatorRow(sequencePoint);
            return { type: 'betweenRows', $rowBefore: $separator, $rowAfter };
        }
    }
    insertSeparatorRow(sequencePoint, $precedingRow) {
        const date = new Date(sequencePoint.timestamp);
        const yearMonthString = toIsoYearMonthString(date);
        const $separator = makeElement('tr')('separator')();
        if ($precedingRow) {
            $precedingRow.after($separator);
        }
        else {
            this.$gridBody.prepend($separator);
        }
        writeSeparatorSequencePoint($separator, date);
        if (!this.withTotalColumn)
            $separator.insertCell();
        const $cell = $separator.insertCell();
        $cell.append(makeDiv()(makeElement('time')()(yearMonthString)));
        $cell.colSpan = this.nColumns + 1 + (this.withTotalColumn ? 1 : 0);
        return $separator;
    }
    findRowsMatchingClassAndItemDescriptor(className, descriptor) {
        const itemSelector = getItemDescriptorSelector(descriptor);
        const itemSelectorWithRow = `tr.${className} ${itemSelector}`;
        const $items = this.$gridBody.querySelectorAll(itemSelectorWithRow);
        const $rows = new Set();
        for (const $item of $items) {
            const $row = $item.closest('tr');
            if (!$row)
                continue;
            $rows.add($row);
        }
        return $rows;
    }
    async toggleItemDisclosureWithButton($button) {
        const $item = $button.closest('.item');
        if (!($item instanceof HTMLElement))
            return;
        const itemDescriptor = readItemDescriptor($item);
        if (!itemDescriptor)
            return;
        if (getDisclosureButtonState($button)) {
            this.collapseItem(itemDescriptor);
        }
        else {
            $button.disabled = true;
            await this.expandItem(itemDescriptor);
            $button.disabled = false;
        }
        const $newItem = $button.closest('.item');
        if ($newItem instanceof HTMLElement) {
            $newItem.scrollIntoView({ block: 'nearest' }); // focusing on button is enough to scroll it in, but it's then too close to the edge
        }
        $button.focus();
    }
    toggleRowStretchWithButton($button) {
        const $row = $button.closest('tr');
        if (!$row)
            return;
        const row = new EmbeddedItemRow($row);
        if (row.isStretched) {
            row.shrink(this.withAbbreviatedIds, this.withAbbreviatedComments);
        }
        else {
            row.stretch(this.withAbbreviatedIds, this.withAbbreviatedComments);
        }
    }
    pingMainItemFromRefButton($button) {
        this.pingItemFromRefButton($button, getMainItemDescriptor);
    }
    pingCommentItemFromRefButton($button) {
        this.pingItemFromRefButton($button, descriptor => {
            const order = Number($button.dataset.order);
            if (!Number.isInteger(order))
                return null;
            return getCommentItemDescriptor(descriptor, order);
        });
    }
    pingItemFromRefButton($button, getTargetDescriptor) {
        const $sourceItem = $button.closest('.item');
        if (!($sourceItem instanceof HTMLElement))
            return;
        const sourceDescriptor = readItemDescriptor($sourceItem);
        if (!sourceDescriptor)
            return;
        const targetDescriptor = getTargetDescriptor(sourceDescriptor);
        if (!targetDescriptor)
            return;
        const $targetItem = this.$gridBody.querySelector(preferSameColumnSelector($sourceItem, getItemDescriptorSelector(targetDescriptor)));
        if (!($targetItem instanceof HTMLElement))
            return;
        $targetItem.scrollIntoView({ block: 'nearest' });
        const $targetFocusable = $targetItem.querySelector(':scope > .icon:first-child :is(input,button,[tabindex])');
        if ($targetFocusable instanceof HTMLElement) {
            $targetFocusable.focus();
        }
        this.highlightClickedItem($targetItem);
    }
    highlightHoveredItemDescriptor(descriptor, refDescriptor) {
        let broadSelector = getBroadItemDescriptorSelector(descriptor);
        let narrowSelector = getItemDescriptorSelector(descriptor);
        if (refDescriptor) {
            narrowSelector += ', ' + getItemDescriptorSelector(refDescriptor);
        }
        for (const $item of this.$gridBody.querySelectorAll(broadSelector)) {
            $item.classList.add('highlighted-by-hover-indirectly');
        }
        for (const $item of this.$gridBody.querySelectorAll(narrowSelector)) {
            $item.classList.remove('highlighted-by-hover-indirectly');
            $item.classList.add('highlighted-by-hover');
        }
    }
    unhighlightHoveredItemDescriptor(descriptor) {
        for (const $item of this.$gridBody.querySelectorAll(getBroadItemDescriptorSelector(descriptor))) {
            $item.classList.remove('highlighted-by-hover', 'highlighted-by-hover-indirectly');
        }
    }
    highlightClickedItem($item) {
        requestAnimationFrame(() => {
            $item.classList.remove('highlighted-by-click-and-fading');
            $item.classList.add('highlighted-by-click');
            requestAnimationFrame(() => {
                $item.classList.remove('highlighted-by-click');
                $item.classList.add('highlighted-by-click-and-fading');
            });
        });
    }
    unhighlightClickedItem($item) {
        $item.classList.remove('highlighted-by-click');
        $item.classList.remove('highlighted-by-click-and-fading');
    }
    reverseCommentRefsWithButton($button) {
        const reverse = ($e) => $e.replaceChildren(...[...$e.childNodes].reverse());
        const $badge = $button.parentElement;
        if (!$badge || !$badge.matches('.badge'))
            return;
        reverse($badge);
        for (const $arrow of $badge.querySelectorAll(':scope > .arrow')) {
            $arrow.classList.toggle('to-left');
            $arrow.classList.toggle('to-right');
        }
        const $content = $badge.querySelector(':scope > .content');
        if ($content) {
            reverse($content);
        }
        $button.focus();
    }
}
function getSingleRowLeadingItem($row) {
    const row = new EmbeddedItemRow($row);
    const itemSequence = [...row.getItemSequence()];
    if (itemSequence.length == 0)
        return null;
    const [[, items]] = itemSequence;
    if (items.length == 0)
        return null;
    const [[, $item]] = items;
    return $item;
}
function isChangesetOpenedClosedPair($openedItem, $closedItem) {
    if ($openedItem.dataset.type != 'changeset' || $closedItem.dataset.type != 'changesetClose')
        return false;
    return $openedItem.dataset.id == $closedItem.dataset.id;
}
function isOpenedClosedPair(a, b) {
    if (a.type != 'changeset' || b.type != 'changesetClose')
        return false;
    return a.id == b.id;
}
function isHiddenItem($item) {
    return $item.classList.contains('item') && $item.hidden;
}
function isSameMonthTimestamps(t1, t2) {
    const d1 = new Date(t1);
    const d2 = new Date(t2);
    return d1.getUTCFullYear() == d2.getUTCFullYear() && d1.getUTCMonth() == d2.getUTCMonth();
}
function preferSameColumnSelector($item, selector) {
    const $cell = $item.closest('td');
    if (!$cell || !$cell.parentElement || $cell.hasAttribute('colspan'))
        return selector;
    const iCell = [...$cell.parentElement.children].indexOf($cell);
    if (iCell < 0)
        return selector;
    return `td:is(:nth-child(${iCell + 1}),[colspan]) ${selector}`;
}
function union(sets) {
    return new Set((function* () {
        for (const set of sets) {
            yield* set;
        }
    })());
}

class Grid {
    constructor(colorizer, cx, db, worker, more, sendUpdatedUserQueriesReceiver, resetMapViewReceiver, redrawMapViewReceiver, addItemToMapViewReceiver) {
        this.$grid = makeElement('table')('grid')();
        this.addExpandedItems = false;
        this.onExternalControlsStateUpdate = () => { };
        this.$colgroup = makeElement('colgroup')()();
        this.body = new GridBody(colorizer, cx.server, db.getSingleItemReader(), resetMapViewReceiver, addItemToMapViewReceiver);
        this.head = new GridHead(colorizer, cx, db, worker, columnUids => this.setColumns(columnUids), (iShiftFrom, iShiftTo) => this.body.reorderColumns(iShiftFrom, iShiftTo), () => this.body.getColumnCheckboxStatuses(), (iColumn, isChecked) => this.body.triggerColumnCheckboxes(iColumn, isChecked), (uid) => {
            for (const $e of this.$grid.querySelectorAll(`[data-hue-uid="${uid}"]`)) {
                if (!($e instanceof HTMLElement))
                    continue;
                writeHueAttributes(colorizer, $e, uid);
            }
            redrawMapViewReceiver();
        }, sendUpdatedUserQueriesReceiver, () => {
            more.changeToNothingToLoad();
            more.$button.onclick = null;
        }, (requestNextBatch) => {
            more.changeToLoad();
            more.$button.onclick = () => {
                more.changeToLoading();
                requestNextBatch();
            };
        }, (batch, usernames) => {
            let wroteAnyItem = false;
            for (const batchItem of batch) {
                const wroteItem = this.body.addItem(batchItem, usernames, this.addExpandedItems);
                wroteAnyItem || (wroteAnyItem = wroteItem);
            }
            if (wroteAnyItem) {
                this.updateTableAfterOptionChanges();
                more.changeToLoadMore();
            }
            else {
                more.changeToLoadedAll();
                more.$button.onclick = null;
            }
        });
        this.body.onItemSelect = () => this.head.updateSelectors();
        this.$grid.append(this.$colgroup, this.head.$gridHead, this.body.$gridBody);
        this.setColumns([]);
    }
    set withClosedChangesets(value) {
        this.body.withClosedChangesets = value;
    }
    get withTotalColumn() {
        return this.body.withTotalColumn;
    }
    get expandedItemOptions() {
        return this.body.expandedItemOptions;
    }
    get collapsedItemOptions() {
        return this.body.collapsedItemOptions;
    }
    setColumns(columnUids) {
        this.body.setColumns(columnUids);
        this.$grid.classList.toggle('without-total-column', !this.withTotalColumn);
        this.$grid.style.setProperty('--columns', String(this.body.nColumns));
        this.$colgroup.replaceChildren();
        if (this.withTotalColumn) {
            this.$colgroup.append(makeElement('col')('all')());
        }
        for (let i = 0; i < this.body.nColumns; i++) {
            this.$colgroup.append(makeElement('col')()());
        }
        this.$colgroup.append(makeElement('col')('all')());
        this.onExternalControlsStateUpdate();
    }
    async receiveUpdatedUserQueries(userQueries) {
        await this.head.receiveUpdatedUserQueries(userQueries);
    }
    async addUserQueries(userQueries) {
        await this.head.addUserQueries(userQueries);
    }
    updateTableAfterOptionChanges() {
        this.body.updateTableAfterItemInsertsOrOptionChanges();
    }
    updateTableAfterExpandedItemOptionChanges() {
        this.body.updateTableAfterExpandedItemOptionChanges();
    }
    updateTableAfterCollapsedItemOptionChanges() {
        this.body.updateTableAfterCollapsedItemOptionChanges();
    }
    updateTableAfterAbbreviationOptionChanges() {
        this.body.updateTableAfterAbbreviationOptionChanges();
    }
    async expandSelectedItems() {
        for (const id of this.body.listSelectedChangesetIds()) {
            await this.body.expandItem({ type: 'changeset', id });
        }
    }
    collapseSelectedItems() {
        for (const id of this.body.listSelectedChangesetIds()) {
            this.body.collapseItem({ type: 'changeset', id });
        }
    }
    stretchAllItems() {
        this.body.stretchAllItems();
    }
    shrinkAllItems() {
        this.body.shrinkAllItems();
    }
    listSelectedChangesetIds() {
        return this.body.listSelectedChangesetIds();
    }
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}

var _More_autoLoad;
class More {
    constructor() {
        this.$button = makeElement('button')()(`Load more`);
        this.$div = makeDiv('more')(this.$button);
        _More_autoLoad.set(this, false);
        this.inLoadMoreState = false;
        this.intersectionObserver = new IntersectionObserver((entries) => {
            if (entries.length == 0)
                return;
            if (!entries[0].isIntersecting)
                return;
            this.$button.click();
        });
        this.changeToNothingToLoad();
    }
    get autoLoad() {
        return __classPrivateFieldGet(this, _More_autoLoad, "f");
    }
    set autoLoad(value) {
        __classPrivateFieldSet(this, _More_autoLoad, value, "f");
        this.updateIntersectionObserver();
    }
    changeToNothingToLoad() {
        this.inLoadMoreState = false;
        this.updateIntersectionObserver();
        this.$div.hidden = true;
    }
    changeToLoad() {
        this.inLoadMoreState = false;
        this.updateIntersectionObserver();
        this.$div.hidden = false;
        this.$button.disabled = false;
        this.$button.textContent = `Load changesets`;
    }
    changeToLoading() {
        this.inLoadMoreState = false;
        this.updateIntersectionObserver();
        this.$div.hidden = false;
        this.$button.disabled = true;
        this.$button.textContent = `Loading changesets...`;
    }
    changeToLoadedAll() {
        this.inLoadMoreState = false;
        this.updateIntersectionObserver();
        this.$div.hidden = false;
        this.$button.disabled = true;
        this.$button.textContent = `Loaded all changesets`;
    }
    changeToLoadMore() {
        this.inLoadMoreState = true;
        this.updateIntersectionObserver();
        this.$div.hidden = false;
        this.$button.disabled = false;
        this.$button.textContent = `Load more changesets`;
    }
    updateIntersectionObserver() {
        if (this.inLoadMoreState && this.autoLoad) {
            this.intersectionObserver.observe(this.$button);
        }
        else {
            this.intersectionObserver.disconnect();
        }
    }
}
_More_autoLoad = new WeakMap();

const minHeight = 32;
let ResizerDragListener$1 = class ResizerDragListener extends DragListener {
    constructor($resizer, $panel) {
        super($resizer);
        this.$panel = $panel;
        this.cursorHovering = 'row-resize';
        this.cursorGrabbing = 'row-resize';
    }
    beginDrag(ev) {
        return {
            pointerId: ev.pointerId,
            startY: ev.clientY,
            startHeight: this.$panel.clientHeight
        };
    }
    doDrag(ev, grab) {
        const newHeight = Math.max(minHeight, grab.startHeight - (ev.clientY - grab.startY));
        this.$panel.style.height = `${newHeight}px`;
    }
};
class Panel {
    makePanelAndButton() {
        const $resizer = makeElement('button')('resizer')();
        const $section = makeElement('section')()();
        const $panel = makeDiv('panel', this.className)($resizer, $section);
        $panel.hidden = true;
        new ResizerDragListener$1($resizer, $panel).install();
        const $button = makeElement('button')()(this.buttonLabel);
        $button.setAttribute('aria-expanded', String(!$panel.hidden));
        $button.onclick = () => {
            $panel.hidden = !$panel.hidden;
            $button.setAttribute('aria-expanded', String(!$panel.hidden));
        };
        this.writeSection($section);
        return [$panel, $button];
    }
}

class LogPanel extends Panel {
    constructor(server) {
        super();
        this.server = server;
        this.className = 'log';
        this.buttonLabel = `Fetch log`;
    }
    writeSection($section) {
        const $logList = ul();
        const $logClearButton = makeElement('button')()(`clear`);
        $logClearButton.onclick = () => {
            $logList.replaceChildren();
        };
        $section.append(makeElement('h2')()(`Fetches`), makeDiv('controls')($logClearButton), $logList);
        const broadcastReceiver = new WorkerBroadcastReceiver(this.server.host);
        broadcastReceiver.onmessage = ({ data: message }) => {
            if (message.type != 'log' || message.part.type != 'fetch')
                return;
            const atBottom = $section.offsetHeight + $section.scrollTop >= $section.scrollHeight - 16;
            const path = message.part.path;
            let docHref;
            if (path.startsWith(`changesets.json`)) {
                docHref = `https://wiki.openstreetmap.org/wiki/API_v0.6#Query:_GET_/api/0.6/changesets`;
            }
            else if (path.startsWith(`notes/search.json`)) {
                docHref = `https://wiki.openstreetmap.org/wiki/API_v0.6#Search_for_notes:_GET_/api/0.6/notes/search`;
            }
            else if (path.match(/^user\/\d+\.json/)) {
                docHref = `https://wiki.openstreetmap.org/wiki/API_v0.6#Details_of_a_user:_GET_/api/0.6/user/#id`;
            }
            const href = this.server.api.getUrl(path);
            const $li = li(makeLink(href, href));
            if (docHref) {
                $li.append(` [`, makeLink(`?`, docHref), `]`);
            }
            $logList.append($li);
            if (atBottom) {
                $li.scrollIntoView();
            }
        };
    }
}

class GridSettingsPanel extends Panel {
    constructor(grid) {
        super();
        this.grid = grid;
        this.className = 'tools';
        this.buttonLabel = `Grid settings`;
    }
    writeSection($section) {
        const makeGridCheckbox = (setOption, initialValue, label, labelTitle) => {
            const $checkbox = makeElement('input')()();
            $checkbox.type = 'checkbox';
            $checkbox.checked = initialValue;
            $checkbox.oninput = () => setOption($checkbox.checked);
            const $label = makeLabel()($checkbox, ` `, label);
            if (labelTitle)
                $label.title = labelTitle;
            return makeDiv('input-group')($label);
        };
        const makeItemOptionsTable = (itemOptions, legend, updateGridAfterOptionChanges, updateGridAfterAbbreviationOptionChanges) => {
            const $table = makeElement('table')()();
            const $headSection = makeElement('thead')()();
            $table.append($headSection);
            const $allSection = makeElement('tbody')()();
            $table.append($allSection);
            const $typeSection = makeElement('tbody')()();
            $table.append($typeSection);
            $typeSection.hidden = true;
            {
                const $row = $headSection.insertRow();
                {
                    const $cell = $row.insertCell();
                    const $button = makeDisclosureButton(false, `item types`);
                    $button.onclick = () => {
                        const state = !getDisclosureButtonState($button);
                        $typeSection.hidden = !state;
                        setDisclosureButtonState($button, state);
                    };
                    $cell.append($button);
                }
                for (const itemOption of itemOptions) {
                    const $cell = makeElement('th')()(itemOption.label);
                    $cell.title = itemOption.title ?? itemOption.name;
                    $row.append($cell);
                }
            }
            {
                const $row = $allSection.insertRow();
                {
                    const $cell = makeElement('th')()();
                    $cell.textContent = `all item types`;
                    $row.append($cell);
                }
                for (const itemOption of itemOptions) {
                    const $cell = $row.insertCell();
                    $cell.dataset.option = itemOption.name;
                    const $checkbox = makeElement('input')()();
                    $checkbox.type = 'checkbox';
                    $checkbox.checked = itemOption.all;
                    $checkbox.oninput = () => {
                        itemOption.all = $checkbox.checked;
                        for (const $typeCheckbox of $typeSection.querySelectorAll(`td[data-option="${itemOption.name}"] input`)) {
                            if (!($typeCheckbox instanceof HTMLInputElement))
                                continue;
                            $typeCheckbox.checked = $checkbox.checked;
                        }
                        updateGridAfterOptionChanges();
                    };
                    $cell.append($checkbox);
                }
            }
            const writeSingleOptionRow = ($row, itemType, checkboxListener) => {
                {
                    const $cell = makeElement('th')()();
                    $cell.textContent = itemType;
                    $row.append($cell);
                }
                for (const itemOption of itemOptions) {
                    const $cell = $row.insertCell();
                    $cell.dataset.option = itemOption.name;
                    if (!itemOption.hasType(itemType))
                        continue;
                    const $checkbox = makeElement('input')()();
                    $checkbox.type = 'checkbox';
                    $checkbox.checked = itemOption[itemType];
                    $checkbox.oninput = () => {
                        itemOption[itemType] = $checkbox.checked;
                        checkboxListener(itemOption);
                    };
                    $cell.append($checkbox);
                }
            };
            for (const itemType of itemOptions.allTypes) {
                const $row = $typeSection.insertRow();
                writeSingleOptionRow($row, itemType, itemOption => {
                    const $allCheckbox = $allSection.querySelector(`td[data-option="${itemOption.name}"] input`);
                    if ($allCheckbox instanceof HTMLInputElement) {
                        $allCheckbox.checked = itemOption.all;
                        $allCheckbox.indeterminate = !itemOption.all && itemOption.some;
                    }
                    updateGridAfterOptionChanges();
                });
            }
            if (updateGridAfterAbbreviationOptionChanges) {
                const $abbrSection = makeElement('tbody')()();
                $table.append($abbrSection);
                const $row = $abbrSection.insertRow();
                writeSingleOptionRow($row, 'abbreviate', () => updateGridAfterOptionChanges());
            }
            return makeElement('fieldset')()(makeElement('legend')()(legend), $table);
        };
        $section.append(makeElement('h2')()(`Grid settings`), makeGridCheckbox(value => {
            this.grid.withClosedChangesets = value;
            this.grid.updateTableAfterOptionChanges();
        }, false, `changeset close events`, `visible only if there's some other event between changeset opening and closing`), makeItemOptionsTable(this.grid.expandedItemOptions, `expanded items`, () => this.grid.updateTableAfterExpandedItemOptionChanges()), makeItemOptionsTable(this.grid.collapsedItemOptions, `collapsed items`, () => this.grid.updateTableAfterCollapsedItemOptionChanges(), () => this.grid.updateTableAfterAbbreviationOptionChanges()));
    }
}

const e = makeEscapeTag(encodeURIComponent);
class ActionsPanel extends Panel {
    constructor(server, grid) {
        super();
        this.server = server;
        this.grid = grid;
        this.className = 'tools';
        this.buttonLabel = `Actions`;
    }
    writeSection($section) {
        $section.append(makeElement('h2')()(`Actions`));
        {
            const $typeSelect = makeElement('select')()(new Option('URLs'), new Option('ids'));
            const $separatorInput = makeElement('input')()();
            $separatorInput.type = 'text';
            $separatorInput.size = 3;
            $separatorInput.value = `\\n`;
            const $button = makeElement('button')()(`📋`);
            $button.onclick = async () => {
                const separator = $separatorInput.value.replace(/\\(.)/g, (_, c) => {
                    if (c == 'n')
                        return '\n';
                    if (c == 't')
                        return '\t';
                    return c;
                });
                let text = '';
                let first = true;
                for (const id of this.grid.listSelectedChangesetIds()) {
                    if (first) {
                        first = false;
                    }
                    else {
                        text += separator;
                    }
                    if ($typeSelect.value == 'URLs') {
                        const changesetUrl = this.server.web.getUrl(e `changeset/${id}`);
                        text += changesetUrl;
                    }
                    else {
                        text += id;
                    }
                }
                await navigator.clipboard.writeText(text);
            };
            $section.append(makeDiv('input-group')(`Copy `, $typeSelect, ` `, makeLabel()(`separated by `, $separatorInput), ` `, `to clipboard `, $button));
        }
        {
            const $button = makeElement('button')()(`Open with RC`);
            $button.onclick = async () => {
                for (const id of this.grid.listSelectedChangesetIds()) {
                    const changesetUrl = this.server.web.getUrl(e `changeset/${id}`);
                    const rcPath = e `import?url=${changesetUrl}`;
                    await openRcPath($button, rcPath);
                }
            };
            $section.append(makeDiv('input-group')($button));
        }
        {
            const $button = makeElement('button')()(`Revert with RC`);
            $button.onclick = async () => {
                for (const id of this.grid.listSelectedChangesetIds()) {
                    const rcPath = e `revert_changeset?id=${id}`;
                    await openRcPath($button, rcPath);
                }
            };
            $section.append(makeDiv('input-group')($button));
        }
    }
}
async function openRcPath($button, rcPath) {
    const rcUrl = `http://127.0.0.1:8111/` + rcPath;
    try {
        const response = await fetch(rcUrl);
        if (response.ok) {
            clearError();
            return true;
        }
    }
    catch { }
    setError();
    return false;
    function setError() {
        $button.classList.add('error');
        $button.title = 'Remote control command failed. Make sure you have an editor open and remote control enabled.';
    }
    function clearError() {
        $button.classList.remove('error');
        $button.title = '';
    }
}

class ListPanel extends Panel {
    constructor(server, grid) {
        super();
        this.server = server;
        this.grid = grid;
        this.className = 'list';
        this.buttonLabel = `List of users`;
    }
    writeSection($section) {
        const scrollSyncTimeout = 300;
        let lastInputScrollTimestamp = 0;
        let lastOutputScrollTimestamp = 0;
        let queries = [];
        const $inputTextarea = makeElement('textarea')()();
        const $outputTextarea = makeElement('textarea')()();
        const $skipMarkersCheckbox = makeElement('input')()();
        const $addButton = makeElement('button')()(`Add users`);
        $outputTextarea.setAttribute('readonly', '');
        $inputTextarea.rows = $outputTextarea.rows = 10;
        $skipMarkersCheckbox.type = 'checkbox';
        $addButton.disabled = true;
        $inputTextarea.onscroll = () => {
            const t = performance.now();
            if (t - lastOutputScrollTimestamp < scrollSyncTimeout)
                return;
            lastInputScrollTimestamp = t;
            $outputTextarea.scrollTop = $inputTextarea.scrollTop;
        };
        $outputTextarea.onscroll = () => {
            const t = performance.now();
            if (t - lastInputScrollTimestamp < scrollSyncTimeout)
                return;
            lastOutputScrollTimestamp = t;
            $inputTextarea.scrollTop = $outputTextarea.scrollTop;
        };
        $inputTextarea.oninput = $skipMarkersCheckbox.oninput = () => {
            queries = [];
            let output = ``;
            for (let line of $inputTextarea.value.split('\n')) {
                if (output)
                    output += `\n`;
                if ($skipMarkersCheckbox.checked) {
                    const match = line.match(/^\s*\d*[-.*)]\s+(.*)/);
                    if (match) {
                        [, line] = match;
                    }
                }
                const query = toUserQuery(this.server.api, this.server.web, line);
                if (query.type == 'empty') {
                    output += ` `;
                }
                else if (query.type == 'id') {
                    queries.push(query);
                    output += ` uid # ` + query.uid;
                }
                else if (query.type == 'name') {
                    queries.push(query);
                    output += `name : ` + query.username;
                }
                else {
                    output += `????`;
                }
            }
            $outputTextarea.value = output;
            $addButton.disabled = queries.length == 0;
        };
        $addButton.onclick = async () => {
            await this.grid.addUserQueries(queries);
        };
        $section.append(makeElement('h2')()(`Add a list of users`), makeDiv('io')(makeDiv()(makeDiv('major-input-group')(makeLabel()(`Input list of users `, $inputTextarea)), makeDiv('input-group')(makeLabel()($skipMarkersCheckbox, ` remove list markers`))), makeDiv()(makeDiv('major-input-group')(makeLabel()(`Parsed list of users `, $outputTextarea)), makeDiv('major-input-group')($addButton))));
    }
}

class Footer {
    constructor($root, $footer, $netDialog, server, grid, more, toggleMap) {
        this.$mapButton = makeElement('button')()(`Map`);
        const $panelButtons = [];
        const addPanel = ([$panel, $button]) => {
            $footer.append($panel);
            $panelButtons.push($button);
        };
        if (server)
            addPanel(new LogPanel(server).makePanelAndButton());
        if (grid)
            addPanel(new GridSettingsPanel(grid).makePanelAndButton());
        if (server && grid)
            addPanel(new ActionsPanel(server, grid).makePanelAndButton());
        if (server && grid)
            addPanel(new ListPanel(server, grid).makePanelAndButton());
        const $toolbar = makeDiv('toolbar')();
        $footer.append($toolbar);
        {
            const $message = makeDiv('message')();
            $toolbar.append($message);
            if (server) {
                const broadcastReceiver = new WorkerBroadcastReceiver(server.host);
                broadcastReceiver.onmessage = ({ data: message }) => {
                    if (message.type != 'operation')
                        return;
                    $message.replaceChildren(strong(message.part.status), ` `, message.part.text);
                    if (message.part.status == 'failed') {
                        $message.append(`: `, strong(message.part.failedText));
                    }
                };
            }
        }
        if (more) {
            const $checkbox = makeElement('input')()();
            $checkbox.type = 'checkbox';
            $checkbox.oninput = () => {
                more.autoLoad = $checkbox.checked;
            };
            $toolbar.append(makeDiv('input-group')(makeLabel()($checkbox, ` auto load more`)));
        }
        if (server) {
            const $checkbox = makeElement('input')()();
            $checkbox.type = 'checkbox';
            $checkbox.oninput = () => {
                $root.classList.toggle('with-time', $checkbox.checked);
            };
            $toolbar.append(makeDiv('input-group')(makeLabel()($checkbox, ` time`)));
        }
        if (grid) {
            const $checkbox = makeElement('input')()();
            $checkbox.type = 'checkbox';
            $checkbox.oninput = () => {
                grid.addExpandedItems = $checkbox.checked;
            };
            $toolbar.append(makeDiv('input-group')(makeLabel()($checkbox, ` add expanded items`)));
        }
        if (grid) {
            const addButton = (label, title, action) => {
                const $button = makeElement('button')()(label);
                $button.title = title;
                $button.onclick = action;
                $toolbar.append($button);
                return $button;
            };
            addButton(`+`, `Expand selected items`, () => { grid.expandSelectedItems(); });
            addButton(`−`, `Collapse selected items`, () => { grid.collapseSelectedItems(); });
            const $stretchAllButton = addButton(`<*>`, `Stretch all items`, () => { grid.stretchAllItems(); });
            const $shrinkAllButton = addButton(`>*<`, `Shrink all items`, () => { grid.shrinkAllItems(); });
            (grid.onExternalControlsStateUpdate = () => {
                $stretchAllButton.disabled = $shrinkAllButton.disabled = !grid.withTotalColumn;
            })();
        }
        for (const $button of $panelButtons) {
            $toolbar.append($button);
        }
        {
            const $button = makeElement('button')()(`Servers and logins`);
            $button.onclick = () => {
                $netDialog.showModal();
            };
            $toolbar.append($button);
        }
        if (toggleMap) {
            this.$mapButton.setAttribute('aria-expanded', 'false');
            this.$mapButton.onclick = () => {
                this.$mapButton.setAttribute('aria-expanded', String(toggleMap()));
            };
            $toolbar.append(this.$mapButton);
        }
    }
    set mapVisibility(visibility) {
        this.$mapButton.setAttribute('aria-expanded', String(visibility));
    }
}

function clamp(v1, v, v2) {
    return Math.min(Math.max(v1, v), v2);
}

const minSideSize = 80;
const frMultiplier = 100000;
class ResizerDragListener extends DragListener {
    constructor($root, $aside, $resizer) {
        super($resizer);
        this.$root = $root;
        this.$aside = $aside;
        this.cursorHovering = 'col-resize';
        this.cursorGrabbing = 'col-resize';
    }
    beginDrag(ev) {
        return {
            pointerId: ev.pointerId,
            startX: ev.clientX,
            startAsideWidth: this.$aside.clientWidth
        };
    }
    doDrag(ev, grab) {
        const dx = clamp(minSideSize + grab.startAsideWidth - this.$root.clientWidth, ev.clientX - grab.startX, grab.startAsideWidth - minSideSize);
        let rightSideSizeFr = Math.round(frMultiplier * (grab.startAsideWidth - minSideSize - dx) / (this.$root.clientWidth - 2 * minSideSize));
        if (!Number.isFinite(rightSideSizeFr))
            rightSideSizeFr = minSideSize;
        let leftSideSizeFr = frMultiplier - rightSideSizeFr;
        this.$root.style.setProperty('--left-side-size', `${leftSideSizeFr}fr`);
        this.$root.style.setProperty('--right-side-size', `${rightSideSizeFr}fr`);
    }
}
function writeSidebar($root, $aside, mapWidget) {
    $root.style.setProperty('--min-side-size', `${minSideSize}px`);
    const $resizer = makeElement('button')('resizer')();
    new ResizerDragListener($root, $aside, $resizer).install();
    $aside.append($resizer, mapWidget.$widget);
}

function makeNetDialog(net) {
    const $helpDialog = makeElement('dialog')('help')();
    const $closeButton = makeElement('button')('close')();
    $closeButton.title = `close dialog`;
    $closeButton.innerHTML = `<svg width=32 height=32><use href="#close" /></svg>`;
    $closeButton.onclick = () => {
        $helpDialog.close();
    };
    $helpDialog.append($closeButton, ...net.$sections);
    return $helpDialog;
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

const tilePower = 8;
const tileSizeXY = 2 ** tilePower;
function normalizeViewZoomPoint(view, maxZoom) {
    const z = Math.round(clamp(0, view.z, maxZoom));
    const uvXY = calculateUVXY(z);
    const u = (Math.round(view.u * uvXY) & (uvXY - 1)) / uvXY;
    const v = clamp(0, Math.round(view.v * uvXY), uvXY) / uvXY;
    return { u, v, z };
}
function calculateXYUV(zoom) {
    return .5 ** (tilePower + zoom);
}
function calculateUVXY(zoom) {
    return 2 ** (tilePower + zoom);
}
function calculateU(lon) {
    return (lon + 180) / 360;
}
function calculateV(lat) {
    const maxLat = 85.0511287798;
    const validLatRadians = clamp(-maxLat, lat, maxLat) * Math.PI / 180;
    return (1 - Math.log(Math.tan(validLatRadians) + 1 / Math.cos(validLatRadians)) / Math.PI) / 2;
}
function calculateLon(u) {
    return u * 360 - 180;
}
function calculateLat(v) {
    const n = Math.PI - 2 * Math.PI * v;
    return 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n)));
}

const curveParameter = 0.002; // [px/ms^2]
const dragStepThreshold = 32; // [px]
class AnimationAxis {
    constructor(startPosition, // [px]
    decayOffset, decayDistance, startTime, decayStartTime, decayDuration) {
        this.startPosition = startPosition;
        this.decayOffset = decayOffset;
        this.decayDistance = decayDistance;
        this.startTime = startTime;
        this.decayStartTime = decayStartTime;
        this.decayDuration = decayDuration;
    }
    transitionToDecay(time) {
        if (time < this.decayStartTime) {
            this.decayStartTime = time;
        }
    }
    isLinear(time) {
        return time < this.decayStartTime;
    }
    isEnded(time) {
        return time >= this.decayStartTime + this.decayDuration;
    }
    getPosition(time) {
        let linearTime = time - this.startTime;
        if (time > this.decayStartTime) {
            linearTime = this.decayStartTime - this.startTime;
        }
        let decayRemainingTime = this.decayDuration;
        if (time > this.decayStartTime) {
            decayRemainingTime -= (time - this.decayStartTime);
        }
        if (decayRemainingTime < 0) {
            decayRemainingTime = 0;
        }
        const axisDirection = this.decayOffset / this.decayDistance;
        return (this.startPosition +
            axisDirection * linearTime +
            this.decayOffset - axisDirection * curveParameter * decayRemainingTime ** 2);
    }
}
function makeFlingAnimation(dragStart, startTime, startX, startY, speedX, speedY) {
    const speed = Math.hypot(speedX, speedY);
    const decayDuration = speed / (2 * curveParameter);
    const dp = curveParameter * decayDuration ** 2;
    if (dp < dragStepThreshold) {
        return { type: 'stopped' };
    }
    else {
        const dx = dp * speedX / speed;
        const dy = dp * speedY / speed;
        return {
            type: 'panning',
            dragStart,
            xAxis: new AnimationAxis(startX, dx, dp, startTime, startTime, decayDuration),
            yAxis: new AnimationAxis(startY, dy, dp, startTime, startTime, decayDuration),
        };
    }
}

class Layer {
    constructor() {
        this.$layer = makeDiv('layer')();
    }
}

const TOP = 1;
const RIGHT = 2;
const BOTTOM = 4;
const LEFT = 8;
const bboxThreshold = 16;
const bboxThickness = 2;
const highlightStroke = 'blue';
const highlightBoxThickness = 1;
const subcellSizeXY = 2;
class ItemLayer extends Layer {
    get cellSizeX() { return this.nSubcellsX * subcellSizeXY; }
    get cellSizeY() { return this.nSubcellsY * subcellSizeXY; }
    constructor() {
        super();
        this.items = new Map();
        this.highlightedItems = new Set();
        this.subcells = new Map;
        this.nSubcellsX = 2;
        this.nSubcellsY = 1;
        this.iSubcellX = 1;
        this.iSubcellY = 1;
        this.$canvas = makeElement('canvas')()();
        this.ctx = this.$canvas.getContext('2d');
        this.$layer.append(this.$canvas);
    }
    removeAllItems() {
        this.items.clear();
        this.highlightedItems.clear();
        this.subcells.clear();
        this.nSubcellsX = 2;
        this.nSubcellsY = 1;
        this.iSubcellX = this.iSubcellY = 1;
    }
    addItem(item) {
        const key = item.type + ':' + item.id;
        this.items.set(key, item);
        if (!this.subcells.has(item.uid)) {
            if (this.nSubcellsY < this.nSubcellsX) {
                if (this.iSubcellY >= this.nSubcellsY) {
                    this.nSubcellsY *= 2;
                    this.iSubcellX = 1;
                }
            }
            else {
                if (this.iSubcellX >= this.nSubcellsX) {
                    this.nSubcellsX *= 2;
                    this.iSubcellY = 1;
                }
            }
            this.subcells.set(item.uid, [this.iSubcellX, this.iSubcellY]);
            if (this.nSubcellsY < this.nSubcellsX) {
                if (++this.iSubcellX >= this.nSubcellsX) {
                    this.iSubcellX = this.nSubcellsX / 2;
                    this.iSubcellY++;
                }
            }
            else {
                if (++this.iSubcellY >= this.nSubcellsY) {
                    this.iSubcellY = this.nSubcellsY / 2;
                    this.iSubcellX++;
                }
            }
        }
    }
    getItemBbox(type, id) {
        const key = type + ':' + id;
        const item = this.items.get(key);
        if (!item)
            return null;
        return this.getItemBboxFromInfo(item);
    }
    getItemBboxFromInfo(item) {
        let minLat;
        let minLon;
        let maxLat;
        let maxLon;
        if (item.type == 'changeset') {
            ({ minLat, minLon, maxLat, maxLon } = item);
        }
        else {
            minLat = maxLat = item.lat;
            minLon = maxLon = item.lon;
        }
        return { minLat, minLon, maxLat, maxLon };
    }
    highlightItem(type, id) {
        const key = type + ':' + id;
        this.highlightedItems.add(key);
    }
    unhighlightItem(type, id) {
        const key = type + ':' + id;
        this.highlightedItems.delete(key);
    }
    clear() {
        if (!this.ctx)
            return;
        this.ctx.clearRect(0, 0, this.$canvas.width, this.$canvas.height);
    }
    render(viewBox, colorizer) {
        if (!this.ctx)
            return;
        const getCellFillStyle = (globalMaxCellWeight, cellWeight, uid) => `hsl(${colorizer.getHueForUid(uid)} 80% 50% / ${.5 + .4 * cellWeight / globalMaxCellWeight})`;
        this.$canvas.width = viewBox.x2 - viewBox.x1;
        this.$canvas.height = viewBox.y2 - viewBox.y1;
        this.clear();
        const xyUV = calculateXYUV(viewBox.z);
        const repeatU1 = Math.floor(viewBox.x1 * xyUV);
        const repeatU2 = Math.floor(viewBox.x2 * xyUV);
        if (this.items.size <= 0 || this.subcells.size <= 0)
            return;
        const viewCellX1 = Math.floor(viewBox.x1 / this.cellSizeX);
        const viewCellX2 = Math.ceil(viewBox.x2 / this.cellSizeX);
        const viewCellY1 = Math.floor(viewBox.y1 / this.cellSizeY);
        const viewCellY2 = Math.ceil(viewBox.y2 / this.cellSizeY);
        const nCellsX = viewCellX2 - viewCellX1 + 1;
        const nCellsY = viewCellY2 - viewCellY1 + 1;
        if (nCellsX <= 0 || nCellsY <= 0)
            return;
        const cells = new Map([...this.subcells.keys()].map(uid => [uid, new Float32Array(nCellsX * nCellsY)]));
        const cellBorders = new Uint8Array(nCellsX * nCellsY);
        const changesets = [];
        const highlightedChangesets = [];
        const notes = [];
        const highlightedNotes = [];
        const noteIdsWithoutCellCollisions = this.findNoteIdsWithoutCellCollisions(viewBox.z, this.cellSizeX, this.cellSizeY);
        let globalMaxCellWeight = 0;
        for (const item of this.items.values()) {
            const key = item.type + ':' + item.id;
            const highlighted = this.highlightedItems.has(key);
            const userCells = cells.get(item.uid);
            if (!userCells)
                continue;
            const bbox = this.getItemBboxFromInfo(item);
            for (let repeatU = repeatU1; repeatU <= repeatU2; repeatU++) {
                const uid = item.uid;
                const itemX1 = (calculateU(bbox.minLon) + repeatU) / xyUV;
                const itemX2 = (calculateU(bbox.maxLon) + repeatU) / xyUV;
                const itemY1 = calculateV(bbox.maxLat) / xyUV;
                const itemY2 = calculateV(bbox.minLat) / xyUV;
                if (item.type == 'changeset' && itemX2 - itemX1 > bboxThreshold && itemY2 - itemY1 > bboxThreshold) {
                    const bbox = {
                        x1: Math.round(itemX1), x2: Math.round(itemX2),
                        y1: Math.round(itemY1), y2: Math.round(itemY2)
                    };
                    if (highlighted) {
                        highlightedChangesets.push({ bbox, uid });
                    }
                    else {
                        changesets.push({ bbox, uid });
                    }
                }
                else if (item.type == 'note' && noteIdsWithoutCellCollisions.has(item.id)) {
                    const noteRenderMargin = 32;
                    if (itemX1 >= viewBox.x1 - noteRenderMargin &&
                        itemX2 <= viewBox.x2 + noteRenderMargin &&
                        itemY1 >= viewBox.y1 - noteRenderMargin &&
                        itemY2 <= viewBox.y2 + noteRenderMargin) {
                        const point = { x: Math.round(itemX1), y: Math.round(itemY1) };
                        if (highlighted) {
                            highlightedNotes.push({ point, uid });
                        }
                        else {
                            notes.push({ point, uid });
                        }
                    }
                }
                else {
                    const itemCellX1 = Math.floor(itemX1 / this.cellSizeX);
                    const itemCellX2 = Math.floor(itemX2 / this.cellSizeX);
                    const itemCellY1 = Math.floor(itemY1 / this.cellSizeY);
                    const itemCellY2 = Math.floor(itemY2 / this.cellSizeY);
                    const weightPerCell = item.weight / ((itemCellX2 - itemCellX1 + 1) * (itemCellY2 - itemCellY1 + 1));
                    for (let cy = Math.max(itemCellY1, viewCellY1); cy <= Math.min(itemCellY2, viewCellY2); cy++) {
                        for (let cx = Math.max(itemCellX1, viewCellX1); cx <= Math.min(itemCellX2, viewCellX2); cx++) {
                            const idx = (cx - viewCellX1) + (cy - viewCellY1) * nCellsX;
                            const cellWeight = userCells[idx] += weightPerCell;
                            if (globalMaxCellWeight < cellWeight)
                                globalMaxCellWeight = cellWeight;
                            if (highlighted) {
                                if (cy == itemCellY1)
                                    cellBorders[idx] |= TOP;
                                if (cy == itemCellY2)
                                    cellBorders[idx] |= BOTTOM;
                                if (cx == itemCellX1)
                                    cellBorders[idx] |= LEFT;
                                if (cx == itemCellX2)
                                    cellBorders[idx] |= RIGHT;
                            }
                        }
                    }
                }
            }
        }
        this.renderHeatmap(cells, globalMaxCellWeight, nCellsX, nCellsY, icx => (icx + viewCellX1) * this.cellSizeX - viewBox.x1, icy => (icy + viewCellY1) * this.cellSizeY - viewBox.y1, getCellFillStyle);
        this.renderChangesets(viewBox, changesets, false, getCellFillStyle);
        this.renderNotes(viewBox, notes, false, getCellFillStyle);
        this.renderHeatmapHighlights(cellBorders, nCellsX, nCellsY, icx => (icx + viewCellX1) * this.cellSizeX - viewBox.x1, icy => (icy + viewCellY1) * this.cellSizeY - viewBox.y1);
        this.renderChangesets(viewBox, highlightedChangesets, true, getCellFillStyle);
        this.renderNotes(viewBox, highlightedNotes, true, getCellFillStyle);
    }
    findNoteIdsWithoutCellCollisions(z, cellSizeX, cellSizeY) {
        const cells = new Map();
        const xyUV = calculateXYUV(z);
        for (const item of this.items.values()) {
            if (item.type != 'note')
                continue;
            const itemX = calculateU(item.lon) / xyUV;
            const itemY = calculateV(item.lat) / xyUV;
            const itemCellX = Math.floor(itemX / cellSizeX);
            const itemCellY = Math.floor(itemY / cellSizeY);
            const key = `${itemCellX}:${itemCellY}`;
            if (cells.has(key)) {
                cells.set(key, null);
            }
            else {
                cells.set(key, item.id);
            }
        }
        const resultIds = new Set();
        for (const id of cells.values()) {
            if (id == null)
                continue;
            resultIds.add(id);
        }
        return resultIds;
    }
    renderHeatmap(cells, globalMaxCellWeight, nCellsX, nCellsY, getCellX, getCellY, getCellFillStyle) {
        if (!this.ctx)
            return;
        for (let icy = 0; icy < nCellsY; icy++) {
            for (let icx = 0; icx < nCellsX; icx++) {
                const cellX = getCellX(icx);
                const cellY = getCellY(icy);
                let maxCellWeightUid;
                let maxCellWeight = 0;
                for (const [uid] of this.subcells) {
                    const userCells = cells.get(uid);
                    if (!userCells)
                        continue;
                    const cellWeight = userCells[icx + icy * nCellsX];
                    if (cellWeight > maxCellWeight) {
                        maxCellWeight = cellWeight;
                        maxCellWeightUid = uid;
                    }
                }
                if (maxCellWeightUid == null)
                    continue;
                {
                    const userCells = cells.get(maxCellWeightUid);
                    if (!userCells)
                        continue;
                    this.ctx.fillStyle = getCellFillStyle(globalMaxCellWeight, maxCellWeight, maxCellWeightUid);
                    this.ctx.fillRect(cellX, cellY, this.cellSizeX, this.cellSizeY);
                }
                for (const [uid, [scx, scy]] of this.subcells) {
                    if (uid == maxCellWeightUid)
                        continue;
                    const userCells = cells.get(uid);
                    if (!userCells)
                        continue;
                    const cellWeight = userCells[icx + icy * nCellsX];
                    if (cellWeight <= 0)
                        continue;
                    const subcellX = cellX + scx * subcellSizeXY - subcellSizeXY / 2;
                    const subcellY = cellY + scy * subcellSizeXY - subcellSizeXY / 2;
                    this.ctx.fillStyle = getCellFillStyle(globalMaxCellWeight, cellWeight, uid);
                    this.ctx.clearRect(subcellX, subcellY, subcellSizeXY, subcellSizeXY);
                    this.ctx.fillRect(subcellX, subcellY, subcellSizeXY, subcellSizeXY);
                }
            }
        }
    }
    renderHeatmapHighlights(cellBorders, nCellsX, nCellsY, getCellX, getCellY) {
        if (!this.ctx)
            return;
        this.ctx.strokeStyle = highlightStroke;
        for (let icy = 0; icy < nCellsY; icy++) {
            for (let icx = 0; icx < nCellsX; icx++) {
                const cellX = getCellX(icx);
                const cellY = getCellY(icy);
                const borders = cellBorders[icx + icy * nCellsX];
                if (borders)
                    this.ctx.beginPath();
                if (borders & TOP) {
                    this.ctx.moveTo(cellX, cellY + .5);
                    this.ctx.lineTo(cellX + this.cellSizeX, cellY + .5);
                }
                if (borders & BOTTOM) {
                    this.ctx.moveTo(cellX, cellY + this.cellSizeY - .5);
                    this.ctx.lineTo(cellX + this.cellSizeX, cellY + this.cellSizeY - .5);
                }
                if (borders & LEFT) {
                    this.ctx.moveTo(cellX + .5, cellY);
                    this.ctx.lineTo(cellX + .5, cellY + this.cellSizeY);
                }
                if (borders & RIGHT) {
                    this.ctx.moveTo(cellX + this.cellSizeX - .5, cellY);
                    this.ctx.lineTo(cellX + this.cellSizeX - .5, cellY + this.cellSizeY);
                }
                if (borders)
                    this.ctx.stroke();
            }
        }
    }
    renderChangesets(viewBox, changesets, highlighted, getCellFillStyle) {
        for (const changeset of changesets) {
            this.renderBox(viewBox, getCellFillStyle(1, 0.7, changeset.uid), bboxThickness, // TODO use weight in stroke
            changeset.bbox);
            if (highlighted)
                this.renderBox(viewBox, highlightStroke, highlightBoxThickness, changeset.bbox);
        }
    }
    renderBox(viewBox, stroke, strokeWidth, box) {
        const edgeX1 = viewBox.x1 - bboxThickness;
        const edgeY1 = viewBox.y1 - bboxThickness;
        const edgeX2 = viewBox.x2 - 1 + bboxThickness;
        const edgeY2 = viewBox.y2 - 1 + bboxThickness;
        const bboxX1 = clamp(edgeX1, box.x1, edgeX2);
        const bboxX2 = clamp(edgeX1, box.x2, edgeX2);
        const bboxY1 = clamp(edgeY1, box.y1, edgeY2);
        const bboxY2 = clamp(edgeY1, box.y2, edgeY2);
        const drawLineXY = (x1, x2, y1, y2) => {
            if (!this.ctx)
                return;
            this.ctx.save();
            this.ctx.lineWidth = strokeWidth;
            this.ctx.strokeStyle = stroke;
            this.ctx.beginPath();
            this.ctx.moveTo(x1 - viewBox.x1, y1 - viewBox.y1);
            this.ctx.lineTo(x2 - viewBox.x1, y2 - viewBox.y1);
            this.ctx.stroke();
            this.ctx.restore();
        };
        const drawLineX = (lineX) => {
            if (lineX >= viewBox.x1 - bboxThickness / 2 &&
                lineX < viewBox.x2 + bboxThickness / 2 &&
                bboxY1 < bboxY2)
                drawLineXY(lineX, lineX, bboxY1, bboxY2);
        };
        const drawLineY = (lineY) => {
            if (lineY >= viewBox.y1 - bboxThickness / 2 &&
                lineY < viewBox.y2 + bboxThickness / 2 &&
                bboxX1 < bboxX2)
                drawLineXY(bboxX1, bboxX2, lineY, lineY);
        };
        drawLineX(box.x1 + strokeWidth / 2);
        drawLineX(box.x2 - strokeWidth / 2);
        drawLineY(box.y1 + strokeWidth / 2);
        drawLineY(box.y2 - strokeWidth / 2);
    }
    renderNotes(viewBox, notes, highlighted, getCellFillStyle) {
        if (!this.ctx)
            return;
        for (const note of notes) {
            this.ctx.save();
            this.ctx.translate(note.point.x - viewBox.x1, note.point.y - viewBox.y1);
            this.ctx.fillStyle = getCellFillStyle(1, 0.7, note.uid);
            this.traceNotePath(16, 6);
            this.ctx.fill();
            if (highlighted) {
                this.ctx.strokeStyle = highlightStroke;
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }
    traceNotePath(h, r) {
        if (!this.ctx)
            return;
        const rp = h - r;
        const y = r ** 2 / rp;
        const x = Math.sqrt(r ** 2 - y ** 2);
        const xt = x + x * (r + y) / (h - (r + y));
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.arcTo(-xt, -h, 0, -h, r);
        this.ctx.arcTo(+xt, -h, 0, 0, r);
        this.ctx.closePath();
    }
}

class TileLayer extends Layer {
    constructor(tileProvider) {
        super();
        this.tileProvider = tileProvider;
    }
    clear() {
        this.$layer.replaceChildren();
    }
    render(viewBox) {
        this.clear();
        const viewTileX1 = Math.floor(viewBox.x1 / tileSizeXY);
        const viewTileX2 = Math.ceil(viewBox.x2 / tileSizeXY);
        const viewTileY1 = Math.floor(viewBox.y1 / tileSizeXY);
        const viewTileY2 = Math.ceil(viewBox.y2 / tileSizeXY);
        const tileMask = 2 ** viewBox.z - 1;
        for (let tileY = viewTileY1; tileY < viewTileY2; tileY++) {
            if (tileY < 0 || tileY > tileMask)
                continue;
            const tileOffsetY = tileY * tileSizeXY - viewBox.y1;
            for (let tileX = viewTileX1; tileX < viewTileX2; tileX++) {
                const tileOffsetX = tileX * tileSizeXY - viewBox.x1;
                const $img = makeElement('img')()();
                $img.src = this.tileProvider.urlTemplate
                    .replace('{z}', String(viewBox.z))
                    .replace('{x}', String(tileX & tileMask))
                    .replace('{y}', String(tileY & tileMask));
                $img.style.translate = `${tileOffsetX}px ${tileOffsetY}px`;
                this.$layer.append($img);
            }
        }
    }
}

const speedDecayRate = 0.003;
class MapDragListener extends DragListener {
    constructor($target, start, pan, fling) {
        super($target);
        this.start = start;
        this.pan = pan;
        this.fling = fling;
    }
    beginDrag(ev) {
        if (!this.start())
            return;
        const startX = ev.clientX;
        const startY = ev.clientY;
        const grab = {
            pointerId: ev.pointerId,
            startX, startY,
            currentX: startX,
            currentY: startY,
            currentSpeedX: 0,
            currentSpeedY: 0,
            currentTime: performance.now(),
        };
        return grab;
    }
    doDrag(ev, grab) {
        const newTime = performance.now();
        const dx = ev.clientX - grab.currentX;
        const dy = ev.clientY - grab.currentY;
        const dt = newTime - grab.currentTime;
        const speedDecay = Math.exp(-speedDecayRate * dt);
        grab.currentSpeedX = grab.currentSpeedX * speedDecay + dx / dt * (1 - speedDecay);
        grab.currentSpeedY = grab.currentSpeedY * speedDecay + dy / dt * (1 - speedDecay);
        grab.currentX = ev.clientX;
        grab.currentY = ev.clientY;
        grab.currentTime = newTime;
        this.pan(grab.startX - ev.clientX, grab.startY - ev.clientY);
    }
    endDrag(ev, grab) {
        this.fling(-grab.currentSpeedX, -grab.currentSpeedY);
    }
}

class MapWidget {
    constructor($root, colorizer, tileProvider) {
        this.$widget = makeDiv('map')();
        this.animation = { type: 'stopped' };
        this.itemLayer = new ItemLayer();
        this.view = { u: 0.5, v: 0.5, z: 0 };
        this.tileLayer = new TileLayer(tileProvider);
        const $attribution = makeDiv('attribution')(`© `, makeLink(tileProvider.attributionText, tileProvider.attributionUrl));
        this.$widget.append(...this.layers.map(layer => layer.$layer), $attribution);
        this.animateFrame = (time) => {
            this.requestId = undefined;
            if (this.animation.type == 'zooming') {
                if (time >= this.animation.finish.time) {
                    this.view = this.animation.finish;
                    this.animation = { type: 'stopped' };
                }
                else {
                    const finishWeight = clamp(0, (time - this.animation.start.time) / (this.animation.finish.time - this.animation.start.time), 1);
                    const startWeight = 1 - finishWeight;
                    this.view.u = this.animation.start.u * startWeight + this.animation.finish.u * finishWeight;
                    this.view.v = this.animation.start.v * startWeight + this.animation.finish.v * finishWeight;
                    this.view.z = Math.round(this.animation.start.z * startWeight + this.animation.finish.z * finishWeight);
                    this.scaleLayers(1 * startWeight + 2 ** (this.animation.finish.z - this.animation.start.z) * finishWeight, this.animation.transformOrigin.x, this.animation.transformOrigin.y);
                }
            }
            else if (this.animation.type == 'panning') {
                const xyUV = calculateXYUV(this.view.z);
                const x = this.animation.xAxis.getPosition(time);
                const y = clamp(0, this.animation.yAxis.getPosition(time), 1 / xyUV);
                this.view.u = x * xyUV;
                this.view.v = y * xyUV;
                if (this.animation.xAxis.isEnded(time) && this.animation.yAxis.isEnded(time)) {
                    this.animation = { type: 'stopped' };
                }
                else {
                    const x0 = this.animation.dragStart.u / xyUV;
                    const y0 = this.animation.dragStart.v / xyUV;
                    this.translateLayers(x0 - x, y0 - y);
                }
            }
            if (this.animation.type == 'stopped') {
                this.view = normalizeViewZoomPoint(this.view, tileProvider.maxZoom);
                const renderViewBox = this.makeRenderViewBox();
                if (renderViewBox) {
                    bubbleEvent(this.$widget, 'osmChangesetViewer:mapMoveEnd');
                }
                this.removeLayerTransforms();
                if (!renderViewBox) {
                    for (const layer of this.layers) {
                        layer.clear();
                    }
                }
                else {
                    for (const layer of this.layers) {
                        layer.render(renderViewBox, colorizer);
                    }
                }
            }
            else {
                this.scheduleFrame();
            }
        };
        this.$widget.onwheel = ev => {
            if (this.animation.type == 'zooming')
                return;
            const viewSizeX = this.$widget.clientWidth;
            const viewSizeY = this.$widget.clientHeight;
            if (viewSizeX <= 0 || viewSizeY <= 0)
                return;
            let dz = -Math.sign(ev.deltaY);
            const finishZ = clamp(0, this.view.z + dz, tileProvider.maxZoom);
            dz = finishZ - this.view.z;
            if (dz == 0)
                return;
            const dx = getViewCenterOffset(viewSizeX, ev.offsetX);
            const dy = getViewCenterOffset(viewSizeY, ev.offsetY);
            const xyUV = calculateXYUV(this.view.z);
            const du = Math.round((1 - .5 ** dz) * dx) * xyUV;
            const dv = Math.round((1 - .5 ** dz) * dy) * xyUV;
            const time = performance.now();
            this.animation = {
                type: 'zooming',
                start: { ...this.view, time },
                finish: {
                    u: this.view.u + du,
                    v: clamp(0, this.view.v + dv, 1),
                    z: finishZ,
                    time: time + 300
                },
                transformOrigin: { x: ev.offsetX, y: ev.offsetY },
            };
            this.scheduleFrame();
        };
        new MapDragListener(this.$widget, () => {
            if (this.animation.type != 'stopped')
                return false;
            this.animation = {
                type: 'dragging',
                start: { ...this.view }
            };
            return true;
        }, (dx, dy) => {
            if (this.animation.type != 'dragging')
                return;
            const xyUV = calculateXYUV(this.view.z);
            this.view.u = this.animation.start.u + dx * xyUV;
            this.view.v = this.animation.start.v + dy * xyUV;
            this.translateLayers(-dx, -dy);
        }, (speedX, speedY) => {
            if (this.animation.type != 'dragging')
                return;
            const uvXY = calculateUVXY(this.view.z);
            this.animation = makeFlingAnimation(this.animation.start, performance.now(), this.view.u * uvXY, this.view.v * uvXY, speedX, speedY);
            this.scheduleFrame();
        }).install();
        const resizeObserver = new ResizeObserver(() => this.scheduleFrame());
        resizeObserver.observe(this.$widget);
        $root.addEventListener('osmChangesetViewer:itemHighlight', ({ detail: { type, id } }) => {
            this.itemLayer.highlightItem(type, id);
            this.scheduleFrame();
        });
        $root.addEventListener('osmChangesetViewer:itemUnhighlight', ({ detail: { type, id } }) => {
            this.itemLayer.unhighlightItem(type, id);
            this.scheduleFrame();
        });
        $root.addEventListener('osmChangesetViewer:itemPing', ({ detail: { type, id } }) => {
            const bbox = this.itemLayer.getItemBbox(type, id);
            if (!bbox)
                return;
            this.fitBox(bbox);
        });
    }
    get hashValue() {
        const precision = Math.max(0, Math.ceil(Math.log2(this.view.z)));
        const zoomString = this.view.z.toFixed(0);
        const latString = calculateLat(this.view.v).toFixed(precision);
        const lonString = calculateLon(this.view.u).toFixed(precision);
        return `${zoomString}/${latString}/${lonString}`;
    }
    set hashValue(hashValue) {
        const [zoomString, latString, lonString] = hashValue.split('/');
        if (zoomString == null || latString == null || lonString == null)
            return;
        const zoom = Number(zoomString);
        const lat = Number(latString);
        const lon = Number(lonString);
        if (!Number.isInteger(zoom) || !Number.isFinite(lat) || !Number.isFinite(lon))
            return;
        this.view = {
            u: calculateU(lon),
            v: calculateV(lat),
            z: zoom
        };
        this.animation = { type: 'stopped' };
        this.scheduleFrame();
    }
    get layers() {
        return [this.tileLayer, this.itemLayer];
    }
    reset() {
        this.itemLayer.removeAllItems();
        this.scheduleFrame();
    }
    redraw() {
        this.scheduleFrame();
    }
    addItem(item) {
        this.itemLayer.addItem(item);
        this.scheduleFrame();
    }
    scheduleFrame() {
        if (this.requestId != null)
            return;
        this.requestId = requestAnimationFrame(this.animateFrame);
    }
    makeRenderViewBox() {
        const viewSizeX = this.$widget.clientWidth;
        const viewSizeY = this.$widget.clientHeight;
        if (viewSizeX <= 0 || viewSizeY <= 0) {
            return null;
        }
        const viewCenterOffsetX1 = getViewCenterOffset(viewSizeX, 0);
        const viewCenterOffsetX2 = getViewCenterOffset(viewSizeX, viewSizeX);
        const viewCenterOffsetY1 = getViewCenterOffset(viewSizeY, 0);
        const viewCenterOffsetY2 = getViewCenterOffset(viewSizeY, viewSizeY);
        const uvXY = calculateUVXY(this.view.z);
        const renderView = {
            x1: this.view.u * uvXY + viewCenterOffsetX1,
            x2: this.view.u * uvXY + viewCenterOffsetX2,
            y1: this.view.v * uvXY + viewCenterOffsetY1,
            y2: this.view.v * uvXY + viewCenterOffsetY2,
            z: this.view.z
        };
        return renderView;
    }
    translateLayers(dx, dy) {
        for (const layer of this.layers) {
            layer.$layer.style.translate = `${dx}px ${dy}px`;
        }
    }
    scaleLayers(scale, originX, originY) {
        for (const layer of this.layers) {
            layer.$layer.style.transformOrigin = `${originX}px ${originY}px`;
            layer.$layer.style.scale = String(scale);
        }
    }
    removeLayerTransforms() {
        for (const layer of this.layers) {
            layer.$layer.removeAttribute('style');
        }
    }
    fitBox(box) {
        const u1 = calculateU(box.minLon);
        const u2 = calculateU(box.maxLon);
        const v1 = calculateV(box.maxLat);
        const v2 = calculateV(box.minLat);
        const viewSizeX = this.$widget.clientWidth;
        const viewSizeY = this.$widget.clientHeight;
        if (viewSizeX == 0 || viewSizeY == 0)
            return;
        const viewMarginXY = 16;
        let limitedViewSizeX = viewSizeX;
        if (limitedViewSizeX > 2 * viewMarginXY)
            limitedViewSizeX -= 2 * viewMarginXY;
        let limitedViewSizeY = viewSizeY;
        if (limitedViewSizeY > 2 * viewMarginXY)
            limitedViewSizeY -= 2 * viewMarginXY;
        const u = (u1 + u2) / 2;
        const v = (v1 + v2) / 2;
        const z = Math.min(Math.floor(Math.log2(limitedViewSizeX / (u2 - u1))), Math.floor(Math.log2(limitedViewSizeY / (v2 - v1)))) - tilePower;
        this.view = { u, v, z };
        this.animation = { type: 'stopped' };
        this.scheduleFrame();
    }
}
function getViewCenterOffset(viewSize, viewCornerOffset) {
    return viewCornerOffset - viewSize / 2 - (viewSize & 1) * .5;
}

const appName = 'osm-changeset-viewer';
main();
async function main() {
    if (checkAuthRedirect(appName)) {
        return;
    }
    const $root = makeDiv('ui')();
    document.body.append($root);
    installRelativeTimeListeners($root);
    const $main = makeElement('main')()(makeElement('h1')()(`Changeset viewer`));
    const contentResizeObserver = new ResizeObserver(entries => {
        const mainWidth = entries[0].target.clientWidth;
        $main.style.setProperty('--main-width', `${mainWidth}px`);
    });
    contentResizeObserver.observe($main);
    const $aside = makeElement('aside')()();
    $aside.hidden = true;
    const storage = new PrefixedLocalStorage(appName + '-');
    const net = new Net(appName, 'read_prefs', [`In the future you'll need to login to view redacted data.`], serverListConfig, storage, serverList => new HashServerSelector(serverList), () => { } // TODO event like bubbleEvent($root,'osmChangesetViewer:loginChange')
    );
    const $footer = makeElement('footer')()();
    const $netDialog = makeNetDialog(net);
    $root.append($main, $aside, $footer, $netDialog);
    if (!net.cx) {
        $main.append(makeDiv('notice')(`Please select a valid server`));
        net.serverSelector.installHashChangeListener(net.cx, () => { });
        new Footer($root, $footer, $netDialog);
        return;
    }
    const cx = net.cx;
    let db;
    try {
        db = await ChangesetViewerDBReader.open(cx.server.host);
    }
    catch (ex) {
        $main.append(makeDiv('notice')(`Cannot open the database`), p(`This app uses `, makeLink(`IndexedDB`, `https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API`), ` to store downloaded request results. `, `Some browsers may restrict access to IndexedDB in private/incognito mode. `, `If you are using private windows in Firefox, you may try `, makeLink(`this workaround`, `https://bugzilla.mozilla.org/show_bug.cgi?id=1639542#c9`), `.`));
        return;
    }
    const worker = new SharedWorker('worker.js');
    const more = new More();
    const colorizer = new Colorizer();
    const mapWidget = new MapWidget($root, colorizer, cx.server.tile);
    const grid = new Grid(colorizer, cx, db, worker, more, userQueries => {
        net.serverSelector.pushHostlessHashInHistory(getHashFromUserQueries(userQueries));
    }, () => {
        mapWidget.reset();
    }, () => {
        mapWidget.redraw();
    }, (item) => {
        mapWidget.addItem(item);
    });
    $main.append(makeDiv('notice')(`This is a preview v0.3.0. `, `If you've been using the previous preview, please delete its databases in the browser.`), p(`In Firefox you can do the following to delete old databases: `, em(`Developer tools`), ` (F12) > `, em(`Storage`), ` > `, em(`Indexed DB`), ` > (this website) > `, em(`OsmChangesetViewer[`), `...`, em(`]`), ` (there is likely only `, em(`OsmChangesetViewer[www.openstreetmap.org]`), `, multiple databases are possible if you tried using the changeset viewer with different osm servers). `, `Right-click each one and select `, em(`Delete`), `.`), p(`In Chrome you can do the following: `, em(`DevTools`), ` (F12) > `, em(`Application`), ` > `, em(`Storage`), ` > `, em(`IndexedDB`), ` > `, em(`OsmChangesetViewer[`), `...`, em(`]`), `. `, `Press the `, em(`Delete database`), ` button.`), grid.$grid, more.$div);
    writeSidebar($root, $aside, mapWidget);
    const showMap = () => {
        $aside.hidden = false;
        $main.style.gridArea = `main`;
    };
    const hideMap = () => {
        $aside.hidden = true;
        $main.style.gridArea = `main / main / aside / aside`;
    };
    const footer = new Footer($root, $footer, $netDialog, net.cx.server, grid, more, () => {
        const hostlessHash = net.serverSelector.getHostlessHash();
        const [, queryHash] = detachValueFromHash('map', hostlessHash);
        if ($aside.hidden) {
            showMap();
            const updatedHostlessHash = attachValueToBackOfHash('map', mapWidget.hashValue, queryHash);
            net.serverSelector.replaceHostlessHashInHistory(updatedHostlessHash);
        }
        else {
            hideMap();
            net.serverSelector.replaceHostlessHashInHistory(queryHash);
        }
        return !$aside.hidden;
    });
    net.serverSelector.installHashChangeListener(net.cx, hostlessHash => {
        const [mapHashValue, queryHash] = detachValueFromHash('map', hostlessHash);
        if (mapHashValue != null) {
            mapWidget.hashValue = mapHashValue;
            showMap();
            footer.mapVisibility = true;
        }
        else {
            hideMap();
            footer.mapVisibility = false;
        }
        grid.receiveUpdatedUserQueries(getUserQueriesFromHash(queryHash));
    }, true);
    $root.addEventListener('osmChangesetViewer:mapMoveEnd', () => {
        const hostlessHash = net.serverSelector.getHostlessHash();
        const [, queryHash] = detachValueFromHash('map', hostlessHash);
        const updatedHostlessHash = attachValueToBackOfHash('map', mapWidget.hashValue, queryHash);
        net.serverSelector.replaceHostlessHashInHistory(updatedHostlessHash);
    });
}
function getUserQueriesFromHash(hash) {
    const queries = [];
    for (const hashEntry of hash.split('&')) {
        const match = hashEntry.match(/([^=]*)=(.*)/);
        if (!match)
            continue;
        const [, k, ev] = match;
        const v = decodeURIComponent(ev);
        if (k == 'user') {
            queries.push({
                type: 'name',
                username: v
            });
        }
        else if (k == 'uid') {
            queries.push({
                type: 'id',
                uid: Number(v)
            });
        }
    }
    return queries;
}
function getHashFromUserQueries(queries) {
    return queries.map(query => {
        if (query.type == 'name') {
            return `user=` + escapeHash(query.username);
        }
        else {
            return `uid=` + escapeHash(String(query.uid));
        }
    }).join('&');
}
