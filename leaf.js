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
            if (this.value instanceof Array) {
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
    function Dom(parentDom, elem, context) {
        this.children = [];
        this.attributes = [];
        this.unbindObservables = [];
        this.parentDom = parentDom;
        this.elem = elem;
        this.context = context;
        // attributes
        for (var i = 0; i < this.elem.attributes.length; i++) {
            var attr = this.elem.attributes[i];
            if (attr.name === 'l-for') {
                this.transformIntoLFor(attr.value);
                return this;
            }
            if (__leaf_startsWith(attr.name, 'l-')) {
                this.attributes.push(new LeafAttribute(this, attr.name, attr.value));
            }
        }
        // text content
        if (LeafTextContent.checkIfNeeded(this)) {
            this.textContent = new LeafTextContent(this);
        }
        // children
        for (var i = 0; i < elem.children.length; i++) {
            this.children.push(new Dom(this, elem.children[i], this.context));
        }
        return this;
    }
    Dom.prototype.transformIntoLFor = function (tokenOrigin) {
        console.log('transformIntoLFor: ' + tokenOrigin);
        this.elem.setAttribute('__leaf_for_item__', tokenOrigin);
        this.elem.removeAttribute('l-for');
        this.lForTemplate = this.elem.outerHTML;
        this.lForTokenOrigin = tokenOrigin;
        var ss = tokenOrigin.split(' ');
        var listVariableName = '';
        var itemName = '';
        var indexName = '';
        this.siblings = [this];
        for (var i = 0; i < ss.length; i++) {
            var s = ss[i].replace(' ', '');
            if (!s) {
                continue;
            }
            if (!listVariableName) {
                if (!__leaf_isVariableName(s)) {
                    continue;
                }
                var observable = this.context.data[s];
                if (!observable) {
                    throw new Error('value in token {{' + tokenOrigin + '}} not found');
                }
                if (observable.postValue && observable.__observers) {
                    var value = observable.value;
                    if (!value || !(value instanceof Array)) {
                        throw new Error('value type in token {{' + tokenOrigin + '}} is not an Array or Observable<Array>');
                    }
                    listVariableName = s;
                    continue;
                }
                if (observable instanceof Array) {
                    listVariableName = s;
                    continue;
                }
                throw new Error('value type in token {{' + tokenOrigin + '}} is not an Array or Observable<Array>');
            }
            if (s === 'as') {
                continue;
            }
            if (!itemName) {
                if (s.indexOf(',') > -1) {
                    var vs = s.split(',');
                    if (vs.length != 2) {
                        throw new Error('invalid token for l-for {{' + tokenOrigin + '}}');
                    }
                    itemName = vs[0];
                    if (!__leaf_isVariableName(itemName)) {
                        throw new Error('invalid token for l-for {{' + tokenOrigin + '}}');
                    }
                    if (this.context.data[itemName]) {
                        throw new Error('invalid token for l-for {{' + tokenOrigin + '}}, duplicated name :' + itemName);
                    }
                    // index name
                    indexName = vs[1];
                    if (!__leaf_isVariableName(indexName)) {
                        throw new Error('invalid token for l-for {{' + tokenOrigin + '}}');
                    }
                    if (this.context.data[itemName]) {
                        throw new Error('invalid token for l-for {{' + tokenOrigin + '}}, duplicated name :' + indexName);
                    }
                    break;
                }
                itemName = s;
                if (!__leaf_isVariableName(itemName)) {
                    throw new Error('invalid token for l-for {{' + tokenOrigin + '}}');
                }
                if (this.context.data[itemName]) {
                    throw new Error('invalid token for l-for {{' + tokenOrigin + '}}, duplicated name :' + itemName);
                }
                break;
            }
            break;
        }
        // shift to list-item mode
        this.listKey = listVariableName;
        this.asItemKey = itemName;
        this.asIndexKey = indexName;
        if (!this.asIndexKey) {
            this.asIndexKey = '_index';
        }
        // switch context when scope changed
        this.context = new __LeafContext(this.context.data, this.context.extraData, !itemName);
        // text content
        if (LeafTextContent.checkIfNeeded(this)) {
            this.textContent = new LeafTextContent(this);
        }
        // listen
        var listData = this.getListData();
        if (listData.__observers && listData.postValue) {
            (function (obs, self) {
                var listener = function () {
                    self.executeArray();
                };
                obs.__observers.push(listener);
                self.unbindObservables.push(function () {
                    __leaf_removeInArray(obs.__observers, listener);
                });
            })(listData, this);
        }
        // attributes
        for (var i = 0; i < this.elem.attributes.length; i++) {
            var attr = this.elem.attributes[i];
            if (attr.name === 'l-for') {
                continue;
            }
            if (__leaf_startsWith(attr.name, 'l-')) {
                this.attributes.push(new LeafAttribute(this, attr.name, attr.value));
            }
        }
        // text content
        if (LeafTextContent.checkIfNeeded(this)) {
            this.textContent = new LeafTextContent(this);
        }
        // children
        for (var i = 0; i < this.elem.children.length; i++) {
            this.children.push(new Dom(this, this.elem.children[i], this.context));
        }
    };
    Dom.prototype.rebind = function () {
        for (var i = 0; i < this.unbindObservables.length; i++) {
            this.unbindObservables[i]();
        }
        this.unbindObservables = [];
        for (var i = 0; i < this.attributes.length; i++) {
            this.attributes[i].rebind();
        }
        if (this.textContent) {
            this.textContent.rebind();
        }
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].rebind();
        }
    };
    Dom.prototype.execute = function (ignoreArray) {
        console.log('==== Dom.execute: ' + this.elem.tagName + ' : ' + ignoreArray);
        console.log(this.context);
        if (!ignoreArray && this.listKey) {
            this.executeArray();
            return;
        }
        // normal elem
        for (var i = 0; i < this.attributes.length; i++) {
            this.attributes[i].execute();
        }
        if (this.textContent) {
            this.textContent.execute();
        }
        // children
        for (var i = 0; i < this.children.length; i++) {
            this.children[i].execute(false);
        }
    };
    Dom.prototype.getListData = function () {
        if (!this.listKey) {
            throw new Error('listKey is empty, means this dom is not a l-for dom');
        }
        if (!this.parentDom) {
            throw new Error('l-for element has no parent dom, which is not allowed');
        }
        return this.parentDom.context.data[this.listKey];
    };
    Dom.prototype.executeArray = function () {
        console.log('executeArray: ');
        var dataList = this.getListData();
        if (!dataList) {
            console.error(this.context);
            throw new Error('l-for: array value not found in data. {{' + this.listKey + '}}');
        }
        if (dataList.__observers && dataList.postValue) {
            dataList = dataList.value;
        }
        if (!dataList || !(dataList instanceof Array)) {
            console.error(dataList);
            throw new Error('l-for: value {{' + this.listKey + '}} is not Array type');
        }
        if (!this.parentDom) {
            throw new Error('parent Dom not found');
        }
        // compare
        var toRemove = [];
        var toAppend = [];
        for (var i = 0; i < this.siblings.length || i < dataList.length; i++) {
            if (i >= dataList.length) {
                //delete
                if (i === 0) {
                    this.elem.style.display = 'none';
                }
                else {
                    toRemove.push(this.siblings[i]);
                }
                continue;
            }
            if (i < this.siblings.length) {
                var sibiling = this.siblings[i];
                //update
                sibiling.context.data = dataList[i];
                sibiling.context.extraData[this.asIndexKey] = i;
                console.log('i == ' + i);
                console.log(sibiling.context.extraData);
                if (!this.context.unwrapData) {
                    if (!this.asItemKey) {
                        throw new Error('this.asItemKey is empty');
                    }
                    sibiling.context.extraData[this.asItemKey] = dataList[i];
                }
                if (i === 0) {
                    sibiling.elem.style.display = '';
                }
                this.siblings[i].execute(true);
                continue;
            }
            // create
            var data = dataList[i];
            var ctx = new __LeafContext(data, __leaf_copyeObject(this.context.extraData), this.context.unwrapData);
            ctx.extraData[this.asIndexKey] = i;
            if (!this.context.unwrapData) {
                if (!this.asItemKey) {
                    throw new Error('this.asItemKey is empty');
                }
                ctx.extraData[this.asItemKey] = ctx.data;
            }
            var newDom = new Dom(null, __leaf_createElemByString(this.lForTemplate), ctx);
            toAppend.push(newDom);
            newDom.execute(true);
        }
        console.log('loop end');
        for (var i = 0; i < toRemove.length; i++) {
            __leaf_removeInArray(this.siblings, toRemove[i]);
            this.parentDom.elem.removeChild(toRemove[i].elem);
        }
        var suffixIndex = -1;
        for (var i = 0; i < this.parentDom.elem.children.length; i++) {
            if (this.parentDom.elem.children[i].getAttribute('__leaf_for_item__') === this.lForTokenOrigin) {
                suffixIndex = i;
                continue;
            }
            if (suffixIndex > -1) {
                break;
            }
        }
        if (suffixIndex === -1) {
            throw new Error("suffix index of domList is not found: this means leaf.js unexpectedly delete the hidden first element of l-for, now we couldn't find it any more");
        }
        var next = null;
        if (suffixIndex < this.parentDom.elem.children.length - 1) {
            next = this.parentDom.elem.children[suffixIndex + 1];
        }
        for (var i = 0; i < toAppend.length; i++) {
            if (next) {
                this.parentDom.elem.insertBefore(toAppend[i].elem, next);
            }
            else {
                this.parentDom.elem.appendChild(toAppend[i].elem);
            }
            this.siblings.push(toAppend[i]);
        }
    };
    return Dom;
}());
function __leaf_removeInArray(array, item) {
    if (!(array instanceof Array)) {
        throw new Error('array type is not Array');
    }
    for (var i = 0; i < array.length; i++) {
        if (item === array[i]) {
            array.splice(i, 1);
            return;
        }
    }
}
function __leaf_executeToken(__leaf_token_origin, $, __leaf_extraData, unwrapData) {
    eval(unwrapData ? __leaf_unwrapVariablesOfany($, '$') : '');
    eval(__leaf_unwrapVariablesOfany(__leaf_extraData, '__leaf_extraData'));
    var result = eval(__leaf_token_origin);
    return result;
}
function __leaf_unwrapVariablesOfany(obj, objName) {
    if (!obj) {
        return '';
    }
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
        this.recollectObservables();
        return this;
    }
    LeafToken.prototype.recollectObservables = function () {
        this.observableRefs = [];
        var variableStarted = -1;
        // collect observables
        for (var i = 0; i < this.origin.length; i++) {
            var char = this.origin[i];
            if (__leaf_isEnglishAlphabet(char)) {
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
            var variableName = this.origin.substring(variableStarted, i);
            var observable = this.dom.context.data[variableName];
            if (observable && observable.postValue && observable.__observers) {
                if (variableStarted > 0 && this.origin[variableStarted - 1] === '.') {
                    variableStarted = -1;
                    continue;
                }
                this.observableRefs.push(observable);
            }
            variableStarted = -1;
        }
        if (variableStarted !== -1) {
            // variable until the end
            var variableName = this.origin.substring(variableStarted, this.origin.length);
            var observable = this.dom.context.data[variableName];
            if (observable && observable.postValue && observable.__observers) {
                if (variableStarted > 0 && this.origin[variableStarted - 1] === '.') {
                }
                else {
                    this.observableRefs.push(observable);
                }
            }
        }
    };
    LeafToken.prototype.execute = function () {
        var result = __leaf_executeToken(this.origin, this.dom.context.data, this.dom.context.extraData, this.dom.context.unwrapData);
        return result;
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
        this.tokenOrigin = tokenOrigin;
        this.token = new LeafToken(this.dom, this.tokenOrigin);
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
            return this;
        }
        // listen
        for (var i = 0; i < this.token.observableRefs.length; i++) {
            (function (self, obs) {
                var listener = function (v) {
                    self.execute();
                };
                obs.__observers.push(listener);
                self.dom.unbindObservables.push(function () {
                    __leaf_removeInArray(obs.__observers, listener);
                });
            })(this, this.token.observableRefs[i]);
        }
        return this;
    }
    LeafAttribute.prototype.rebind = function () {
        this.token.recollectObservables();
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
            return this;
        }
        // listen
        for (var i = 0; i < this.token.observableRefs.length; i++) {
            (function (self, obs) {
                var listener = function (v) {
                    self.execute();
                };
                obs.__observers.push(listener);
                self.dom.unbindObservables.push(function () {
                    __leaf_removeInArray(obs.__observers, listener);
                });
            })(this, this.token.observableRefs[i]);
        }
    };
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
            this.dom.elem['value'] = result;
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
                    for (var k = 0; k < t.observableRefs.length; k++) {
                        var obs = t.observableRefs[k];
                        if (existsInArray(obs, observableCollection)) {
                            continue;
                        }
                        observableCollection.push(obs);
                        // listen
                        (function (self, obs) {
                            var listener = function (v) {
                                self.execute();
                            };
                            obs.__observers.push(listener);
                            self.dom.unbindObservables.push(function () {
                                __leaf_removeInArray(obs.__observers, listener);
                            });
                        })(this, obs);
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
    }
    LeafTextContent.prototype.rebind = function () {
        for (var i = 0; i < this.tokens.length; i++) {
            this.tokens[i].recollectObservables();
            for (var j = 0; j < this.tokens[i].observableRefs.length; j++) {
                var obs = this.tokens[i].observableRefs[j];
                (function (self, obs) {
                    var listener = function (v) {
                        self.execute();
                    };
                    obs.__observers.push(listener);
                    self.dom.unbindObservables.push(function () {
                        __leaf_removeInArray(obs.__observers, listener);
                    });
                })(this, obs);
            }
        }
    };
    LeafTextContent.prototype.execute = function () {
        var s = this.template;
        for (var i = 0; i < this.tokens.length; i++) {
            var result = this.tokens[i].execute();
            s = s.replace(this.tokens[i].uniqueID, result);
        }
        this.dom.elem.innerHTML = __leaf_sanitizeHTML(s);
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
        return dom.elem.textContent.indexOf('{{') > -1;
    };
    return LeafTextContent;
}());
function Leaf(id, data) {
    var elem = document.getElementById(id);
    if (!elem || !(elem instanceof HTMLElement)) {
        throw new Error('Leaf() first argument type is not HTMLElement or string(id of the element): ' + elem);
    }
    var dom = new Dom(null, elem, new __LeafContext(data, {
        _root: data
    }, true));
    dom.execute(false);
    return data;
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
    div.innerHTML = s;
    return div.firstChild;
}
function __leaf_isVariableName(str) {
    if (!str) {
        return false;
    }
    for (var i = 0; i < str.length; i++) {
        if (!__leaf_isEnglishAlphabet(str.charAt(i))) {
            return false;
        }
    }
    return true;
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
function __leaf_copyeObject(obj) {
    var c = {};
    for (var key in obj) {
        var value = obj[key];
        if (typeof value === 'object') {
            c[key] = __leaf_copyeObject(value);
            continue;
        }
        c[key] = value;
    }
    return c;
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
var __LeafContext = /** @class */ (function () {
    function __LeafContext(data, extraData, unwrapData) {
        this.data = data;
        this.extraData = extraData;
        this.unwrapData = unwrapData;
    }
    return __LeafContext;
}());
//# sourceMappingURL=leaf.js.map