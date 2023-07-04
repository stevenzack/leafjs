
class Observable {
    __observers: ((v: any) => void)[] = [];
    value: any;
    postValue: (valueOrFunc: any | ((a: any) => any)) => void = function (valueOrFunc: any | ((a: any) => any)) {
        if (typeof valueOrFunc === 'function') {
            valueOrFunc = valueOrFunc(this.value);
        }
        if ((typeof valueOrFunc) != (typeof this.value)) {
            throw new Error('postValue() type mismatch: ' + (typeof valueOrFunc) + ' vs ' + (typeof this.value));
        }
        if (valueOrFunc === this.value) return;
        this.value = valueOrFunc;
        for (var i = 0; i < this.__observers.length; i++) {
            this.__observers[i](this.value);
        }
    };

    constructor(data: any) {
        this.value = data;
        return this;
    }

}

class Dom {
    _parentDom: Dom | null;
    children: Dom[] = [];
    elem: HTMLElement;
    data: any;
    _rootData: any;
    _index: number | undefined;
    attributes: LeafAttribute[] = [];
    textContent: LeafAttribute | null;

    constructor(elem: HTMLElement, data: any, parentDom: Dom | null = null) {
        this._parentDom = parentDom;
        this.elem = elem;
        this.data = data;
        if (!parentDom) {
            this._rootData = data;
        }

        this.parseLeafAttributes();
        // children
        for (var i = 0; i < elem.children.length; i++) {
            this.children.push(new Dom(elem.children[i] as HTMLElement, data, this))
        }
        return this;
    }
    private parseLeafAttributes() {
        for (var i = 0; i < this.elem.attributes.length; i++) {
            var attr = this.elem.attributes[i];
            if (__leaf_startsWith(attr.name, 'l-')) {
                this.attributes.push(new LeafAttribute(this, attr.name, attr.value));
            }
        }
    }

    execute() {
        for (var i = 0; i < this.attributes.length; i++) {
            this.attributes[i].execute();
        }
    }
}
function __leaf_executeToken(__leaf_token_origin: string, $: any, _root: any, _index: number | undefined): any {
    eval(__leaf_unwrapVariablesOfany($, '$'));
    var result = eval(__leaf_token_origin);
    return result
}

function __leaf_unwrapVariablesOfany(obj: any, objName: string): string {
    if (typeof obj !== 'object') {
        return '';
    }

    var builder = '';
    for (var key in obj) {
        var v = obj[key];
        var s = 'var ' + key + '=' + objName + '.' + key;
        if (v.__observers && v.postValue && !(v.value instanceof Array)) {
            s += '.value';
        }
        builder += s + ';';
    }
    return builder;
}
class LeafToken {
    dom: Dom;
    origin: string;
    uniqueID: string;
    observableRefs: Observable[] = [];
    constructor(elem: Dom, tokenOrigin: string) {
        this.dom = elem;
        this.origin = tokenOrigin;
        var variableStarted = -1;
        for (var i = 0; i < tokenOrigin.length; i++) {
            var char = tokenOrigin[i];
            if (__leaf_isVariableName(char)) {
                if (variableStarted === -1) {
                    variableStarted = i;
                    continue;
                }
                continue;
            }
            if (variableStarted === -1) {
                continue;
            }
            // variable ending
            var variableName = tokenOrigin.substring(variableStarted, i);
            var observable = this.dom.data[variableName];
            if (observable && observable.postValue && observable.__observers) {
                if (variableStarted > 0 && tokenOrigin[variableStarted - 1] === '.') {
                    variableStarted = -1;
                    continue;
                }
                this.observableRefs.push(observable);
            }
            variableStarted = -1;
        }
        if (variableStarted !== -1) {
            // variable until the end
            var variableName = tokenOrigin.substring(variableStarted, tokenOrigin.length);
            var observable = this.dom.data[variableName];
            if (observable && observable.postValue && observable.__observers) {
                if (variableStarted > 0 && tokenOrigin[variableStarted - 1] === '.') {
                } else {
                    this.observableRefs.push(observable);
                }
            }
        }
        return this;
    }

    execute(): any {
        return __leaf_executeToken(this.origin, this.dom.data, this.dom._rootData, this.dom._index);
    }
}
class LeafAttribute {
    dom: Dom;
    name: string;
    value: string = '';
    token: LeafToken;

    constructor(dom: Dom, name: string, tokenOrigin: string) {
        if (!__leaf_startsWith(name, 'l-')) {
            throw new Error('invalid executable attribute:' + name);
        }
        this.dom = dom;
        this.name = name.substring(2);
        this.token = new LeafToken(this.dom, tokenOrigin);

        // parse
        if (__leaf_startsWith(this.name, 'style-')) {
            this.value = name.substring(6);
            this.name = 'style';
        } else if (__leaf_startsWith(this.name, 'class:')) {
            this.value = this.name.substring(6);
            this.name = 'class';
        } else if (this.name === 'for') {
            // TODO
        }

        // listen
        (function (self: LeafAttribute) {
            for (var i = 0; i < self.token.observableRefs.length; i++) {
                self.token.observableRefs[i].__observers.push(function (v) {
                    self.execute();
                })
            }
        })(this);

        this.execute();
        return this;
    }
    execute() {
        let result = this.token.execute();
        if (result && result.__observers && result.postValue) {
            result = result.value;
        }

        if (this.name === 'class') {
            if (result) {
                __leaf_addClass(this.dom.elem, this.value);
            } else {
                __leaf_removeClass(this.dom.elem, this.value)
            }
            return;
        }
        if (this.name === 'if') {
            if (result) {
                this.dom.elem.style.display = '';
            } else {
                this.dom.elem.style.display = 'none';
            }
            return;
        }
        if (typeof result === 'boolean') {
            if (result) {
                this.dom.elem.setAttribute(this.name, this.value);
            } else {
                this.dom.elem.removeAttribute(this.name);
            }
            return;
        }

        if (this.name === 'value') {
            this.dom.elem['value'] = result;
        } else {
            this.dom.elem.setAttribute(this.name, result);
        }
    };
}

class LeafTextContent {

}

function Leaf(id: string, data: object): object {
    const elem = document.getElementById(id);
    if (!elem || !(elem instanceof HTMLElement)) {
        throw new Error('Leaf() first argument type is not HTMLElement or string(id of the element): ' + elem);
    }
    const dom = new Dom(elem, data, null);
    return dom.data;
}

function embedHTML(callback: () => void, elemOrId: HTMLElement | string) {
    if (elemOrId) {
        var elem: HTMLElement;
        if (typeof elemOrId === 'string') {
            var e = document.getElementById(elemOrId);
            if (e == null) {
                throw new Error('element with id [' + elemOrId + '] not found');
            }
            elem = e;
        } else if (!elemOrId || !(elemOrId instanceof HTMLElement)) {
            throw new Error('Leaf() first argument type is not HTMLElement or string(id of the element): ' + elemOrId);
        } else {
            elem = elemOrId;
        }
        var src = elem.getAttribute('src');
        if (!src) {
            throw new Error('template.src not set:' + elem.outerHTML)
        }
        __leaf_embedHTML(elem, src, callback);
        return;
    }

    var elems = document.getElementsByTagName('template');
    if (!elems) return;
    var waitGroup = 0;
    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i] as HTMLElement;
        var src = elem.getAttribute('src');
        if (src) {
            waitGroup++;
            __leaf_embedHTML(elem, src, function () {
                waitGroup--;
                if (waitGroup <= 0 && callback) {
                    callback();
                }
            });
        }
    }
}

function __leaf_embedHTML(elem: HTMLElement, src: string, callback: () => void) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }
        if (callback) callback();
        if (xhr.status !== 200) {
            elem.innerText = xhr.status + ': ' + xhr.responseText;
            return;
        }
        elem.outerHTML = xhr.responseText;
    }
    xhr.open('GET', src);
    xhr.send();
}
var __leaf_randomIDs: Record<string, boolean> = {};

function __leaf_generateID(length: number): string {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    var counter = 0;
    for (; counter < length;) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    result = '___' + result + '___'
    if (__leaf_randomIDs[result]) {
        return __leaf_generateID(length);
    }
    __leaf_randomIDs[result] = true;
    return result;
}

function __leaf_isEnglishAlphabet(c: string): boolean {
    var l = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (var i = 0; i < l.length; i++) {
        if (c === l.charAt(i)) {
            return true;
        }
    }
    return false;
}

function __leaf_createElemByString(s: string): HTMLElement {
    var div = document.createElement('div');
    div.outerHTML = s;
    return div;
}

function __leaf_isVariableName(c: string): boolean {
    var l = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < l.length; i++) {
        if (c === l.charAt(i)) {
            return true;
        }
    }
    return false;
}

function __leaf_startsWith(s: string, sep: string): boolean {
    if (s.length < sep.length) {
        return false;
    }
    return s.substring(0, sep.length) === sep;
}

function __leaf_removeClass(elem: HTMLElement, className: string) {
    var s = elem.getAttribute('class');
    if (s) {
        var builder = '';
        const ss = s.split(' ');
        for (var i = 0; i < ss.length; i++) {
            if (ss[i] && ss[i] !== className) {
                builder += ss[i];
            }
        }
        elem.setAttribute('class', builder);
    }
}

function __leaf_addClass(elem: HTMLElement, className: string) {
    var s = elem.getAttribute('class');
    if (!s) {
        elem.setAttribute('class', className);
        return;
    }
    const ss = s.split(' ');
    for (var i = 0; i < ss.length; i++) {
        if (ss[i] && ss[i] === className) {
            return;
        }
    }
    elem.setAttribute('class', s + ' ' + className);
}
function __leaf_sanitizeHTML(s) {
    s = s + '';
    if (typeof s !== 'string') {
        return;
    }
    // sanitize untrusted HTML tag
    s = s.replace('<', '&lt;');
    s = s.replace('>', '&gt;');
    return s;
}
function __leaf_desanitizeHTML(s) {
    if (typeof s !== 'string') {
        return;
    }
    // sanitize untrusted HTML tag
    s = s.replace('&lt;', '<');
    s = s.replace('&gt;', '>');
    return s;
}