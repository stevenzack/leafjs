function Observable(data) {
    var out = {
        __observers: [],
        value: data,
        postValue: function (valueOrFunc) {
            if (typeof valueOrFunc === 'function') {
                valueOrFunc = valueOrFunc(this.value);
            }
            if ((typeof valueOrFunc) != (typeof this.value)) {
                throw new Error('postValue() type mismatch: ' + (typeof valueOrFunc) + ' vs ' + (typeof this.value));
            }
            if (valueOrFunc === this.value)
                return;
            this.value = valueOrFunc;
            for (var i = 0; i < this.__observers.length; i++) {
                this.__observers[i](this.value);
            }
        },
        update: function (fn) {
            fn(this.value);
            this.notifyChange();
        },
        notifyChange: function () {
            for (var i = 0; i < this.__observers.length; i++) {
                this.__observers[i](this.value);
            }
        }
    };
    if (data instanceof Array) {
        out.append = function (v) {
            if (v instanceof Array) {
                this.value.push(v);
            }
            else {
                throw new Error('invalid operation: calling append on a non-array observable value');
            }
            this.notifyChange();
        };
        out.removeAt = function (i) {
            if (typeof i !== 'number') {
                throw new Error('removeAt() argument type is not number');
            }
            this.value.splice(i, 1);
            this.notifyChange();
        };
        out.replace = function (i, v) {
            if (typeof i !== 'number') {
                throw new Error('removeAt() argument type is not number');
            }
            this.value.splice(i, 1, v);
            this.notifyChange();
        };
        out.insertAfter = function (i, v) {
            if (typeof i !== 'number') {
                throw new Error('removeAt() argument type is not number');
            }
            this.value.splice(i, 0, v);
            this.notifyChange();
        };
    }
    else if (typeof data === 'number') {
        out.inc = function (v) {
            if (!v) {
                this.value++;
            }
            else if (typeof v === 'number') {
                this.value += v;
            }
            else {
                throw new Error('invalid input type for inc():' + (typeof v));
            }
            this.notifyChange();
        };
    }
    else if (typeof data === 'boolean') {
        out.toggle = function () {
            this.value = !this.value;
            this.notifyChange();
        };
    }
    return out;
}
var Dom = /** @class */ (function () {
    function Dom(elem, data, parentDom) {
        if (parentDom === void 0) { parentDom = null; }
        this.children = [];
        this.attributes = [];
        this._parentDom = parentDom;
        this.elem = elem;
        this.data = data;
        if (!parentDom) {
            this._rootData = data;
        }
        this.parseLeafAttributes();
        if (LeafTextContent.checkIfNeeded(this)) {
            this.textContent = new LeafTextContent(this);
        }
        // children
        for (var i = 0; i < elem.children.length; i++) {
            this.children.push(new Dom(elem.children[i], data, this));
        }
        return this;
    }
    Dom.prototype.parseLeafAttributes = function () {
        for (var i = 0; i < this.elem.attributes.length; i++) {
            var attr = this.elem.attributes[i];
            if (__leaf_startsWith(attr.name, 'l-')) {
                this.attributes.push(new LeafAttribute(this, attr.name, attr.value));
            }
        }
    };
    Dom.prototype.execute = function () {
        for (var i = 0; i < this.attributes.length; i++) {
            this.attributes[i].execute();
        }
        if (this.textContent) {
            this.textContent.execute();
        }
    };
    return Dom;
}());
function __leaf_executeToken(__leaf_token_origin, $, _root, _index) {
    console.log(__leaf_token_origin);
    console.log($);
    eval(__leaf_unwrapVariablesOfany($, '$'));
    var result = eval(__leaf_token_origin);
    return result;
}
function __leaf_unwrapVariablesOfany(obj, objName) {
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
var LeafToken = /** @class */ (function () {
    function LeafToken(elem, tokenOrigin) {
        this.observableRefs = [];
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
                }
                else {
                    this.observableRefs.push(observable);
                }
            }
        }
        return this;
    }
    LeafToken.prototype.execute = function () {
        return __leaf_executeToken(this.origin, this.dom.data, this.dom._rootData, this.dom._index);
    };
    return LeafToken;
}());
var LeafAttribute = /** @class */ (function () {
    function LeafAttribute(dom, name, tokenOrigin) {
        this.value = '';
        if (!__leaf_startsWith(name, 'l-')) {
            throw new Error('invalid executable attribute:' + name);
        }
        this.dom = dom;
        this.name = name.substring(2);
        this.token = new LeafToken(this.dom, tokenOrigin);
        // parse
        if (__leaf_startsWith(this.name, 'style-')) {
            this.value = this.name.substring(6);
            this.name = 'style';
        }
        else if (__leaf_startsWith(this.name, 'class:')) {
            this.value = this.name.substring(6);
            this.name = 'class';
        }
        else if (this.name === 'for') {
            // TODO
        }
        // listen
        (function (self) {
            for (var i = 0; i < self.token.observableRefs.length; i++) {
                self.token.observableRefs[i].__observers.push(function (v) {
                    self.execute();
                });
            }
        })(this);
        this.execute();
        return this;
    }
    LeafAttribute.prototype.execute = function () {
        var result = this.token.execute();
        if (result && result.__observers && result.postValue) {
            result = result.value;
        }
        if (this.name === 'class') {
            if (result) {
                __leaf_addClass(this.dom.elem, this.value);
            }
            else {
                __leaf_removeClass(this.dom.elem, this.value);
            }
            return;
        }
        if (this.name === 'if') {
            if (result) {
                this.dom.elem.style.display = '';
            }
            else {
                this.dom.elem.style.display = 'none';
            }
            return;
        }
        if (typeof result === 'boolean') {
            if (result) {
                this.dom.elem.setAttribute(this.name, this.value);
            }
            else {
                this.dom.elem.removeAttribute(this.name);
            }
            return;
        }
        if (this.name === 'value') {
            this.dom.elem.value = result;
        }
        else {
            this.dom.elem.setAttribute(this.name, result);
        }
    };
    ;
    return LeafAttribute;
}());
var LeafTextContent = /** @class */ (function () {
    function LeafTextContent(dom) {
        this.tokens = [];
        this.template = '';
        this.dom = dom;
        var nodes = dom.elem.childNodes;
        var observableCollection = [];
        var existsInArray = function (v, array) {
            for (var i = 0; i < observableCollection.length; i++) {
                if (observableCollection[i] === v) {
                    return true;
                }
            }
            return false;
        };
        for (var i = 0; i < nodes.length; i++) {
            // parse
            var s = String(nodes[i].nodeValue);
            var left = -1;
            for (var j = 0; j < s.length; j++) {
                var char1 = s.charAt(j);
                var char2 = '';
                if (j < s.length - 1) {
                    char2 = s.charAt(j + 1);
                }
                if (char1 + char2 === '{{') {
                    left = j;
                    continue;
                }
                if (left > -1 && char1 + char2 === '}}') {
                    var tokenOrigin = s.substring(left + 2, j);
                    var t = new LeafToken(this.dom, tokenOrigin);
                    t.uniqueID = __leaf_generateID(16);
                    var _loop_1 = function () {
                        var obs = t.observableRefs[k];
                        if (existsInArray(obs, observableCollection)) {
                            return "continue";
                        }
                        observableCollection.push(obs);
                        // listen
                        var self_1 = this_1;
                        obs.__observers.push(function (v) {
                            self_1.execute();
                        });
                    };
                    var this_1 = this;
                    for (var k = 0; k < t.observableRefs.length; k++) {
                        _loop_1();
                    }
                    this.tokens.push(t);
                    left = -1;
                    j++;
                    this.template += t.uniqueID;
                    continue;
                }
                if (left === -1) {
                    this.template += char1;
                }
            }
        }
        this.execute();
    }
    LeafTextContent.prototype.execute = function () {
        var s = this.template;
        for (var i = 0; i < this.tokens.length; i++) {
            var result = this.tokens[i].execute();
            s = s.replace(this.tokens[i].uniqueID, result);
        }
        this.dom.elem.innerText = s;
    };
    LeafTextContent.checkIfNeeded = function (dom) {
        // check
        var nodes = dom.elem.childNodes;
        if (dom.elem.children.length > 0) {
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (n && n instanceof Node) {
                    var s = String(n.nodeValue);
                    if (s.indexOf('{{') > -1) {
                        throw new Error('Leaf.js currently don\'t support textContent binding with parentNode\'s other children.length>0, it may lost the binding connection when textContent update. Please wrap your textContent with a <span> or <div>: ' + s);
                    }
                }
            }
            return false;
        }
        return true;
    };
    return LeafTextContent;
}());
function Leaf(id, data) {
    var elem = document.getElementById(id);
    if (!elem || !(elem instanceof HTMLElement)) {
        throw new Error('Leaf() first argument type is not HTMLElement or string(id of the element): ' + elem);
    }
    var dom = new Dom(elem, data, null);
    return dom.data;
}
function embedHTML(callback, elemOrId) {
    if (elemOrId) {
        var elem;
        if (typeof elemOrId === 'string') {
            var e = document.getElementById(elemOrId);
            if (e == null) {
                throw new Error('element with id [' + elemOrId + '] not found');
            }
            elem = e;
        }
        else if (!elemOrId || !(elemOrId instanceof HTMLElement)) {
            throw new Error('Leaf() first argument type is not HTMLElement or string(id of the element): ' + elemOrId);
        }
        else {
            elem = elemOrId;
        }
        var src = elem.getAttribute('src');
        if (!src) {
            throw new Error('template.src not set:' + elem.outerHTML);
        }
        __leaf_embedHTML(elem, src, callback);
        return;
    }
    var elems = document.getElementsByTagName('template');
    if (!elems)
        return;
    var waitGroup = 0;
    for (var i = 0; i < elems.length; i++) {
        var elem = elems[i];
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
function __leaf_embedHTML(elem, src, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }
        if (callback)
            callback();
        if (xhr.status !== 200) {
            elem.innerText = xhr.status + ': ' + xhr.responseText;
            return;
        }
        elem.outerHTML = xhr.responseText;
    };
    xhr.open('GET', src);
    xhr.send();
}
var __leaf_randomIDs = {};
function __leaf_generateID(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    var counter = 0;
    for (; counter < length;) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    result = '___' + result + '___';
    if (__leaf_randomIDs[result]) {
        return __leaf_generateID(length);
    }
    __leaf_randomIDs[result] = true;
    return result;
}
function __leaf_isEnglishAlphabet(c) {
    var l = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (var i = 0; i < l.length; i++) {
        if (c === l.charAt(i)) {
            return true;
        }
    }
    return false;
}
function __leaf_createElemByString(s) {
    var div = document.createElement('div');
    div.outerHTML = s;
    return div;
}
function __leaf_isVariableName(c) {
    var l = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < l.length; i++) {
        if (c === l.charAt(i)) {
            return true;
        }
    }
    return false;
}
function __leaf_startsWith(s, sep) {
    if (s.length < sep.length) {
        return false;
    }
    return s.substring(0, sep.length) === sep;
}
function __leaf_removeClass(elem, className) {
    var s = elem.getAttribute('class');
    if (s) {
        var builder = '';
        var ss = s.split(' ');
        for (var i = 0; i < ss.length; i++) {
            if (ss[i] && ss[i] !== className) {
                builder += ss[i];
            }
        }
        elem.setAttribute('class', builder);
    }
}
function __leaf_addClass(elem, className) {
    var s = elem.getAttribute('class');
    if (!s) {
        elem.setAttribute('class', className);
        return;
    }
    var ss = s.split(' ');
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
