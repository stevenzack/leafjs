function createValue(value) {
    return {
        __observers: [],
        postValue: function (v) {
            this.value = v;
            for (var i = 0; i < this.__observers.length; i++) {
                this.__observers[i](v);
            }
        },
        value: value,
    }
}
var __leaf_randomIDs = {}

function __leaf_generateID(length) {
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

function renderLeaf(elemID, $) {
    return __leaf_parse(document.getElementById(elemID), $);
}
function __leaf_isLowerCaseEnglish(c) {
    var l = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    for (var i = 0; i < l.length; i++) {
        if (c == l.charAt(i)) {
            return true;
        }
    }
    return false;
}

function __leaf_isVariableName(c) {
    var l = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < l.length; i++) {
        if (c == l.charAt(i)) {
            return true;
        }
    }
    return false;
}

function __leaf_parse(elem, $) {
    var s = elem.innerHTML;
    // top level text
    var childLevel = 0;
    var template = [''];
    var leftToken = -1;
    var tokenGroups = [
        [],
    ];
    for (var i = 0; i < s.length - 1; i++) {
        var char1 = s.charAt(i);
        var char2 = s.charAt(i + 1);
        if (char1 == '<') {
            if (char2 == '/') {
                var foundEnding = false;
                i++;
                for (; i < s.length; i++) {
                    if (s.charAt(i) == '>') {
                        foundEnding = true;
                        break;
                    }
                }
                if (!foundEnding) {
                    throw new Error('ending arrow for [</] not found: ' + s.substring(0, i));
                }
                childLevel--;
                if (childLevel == 0) {
                    template.push('');
                    tokenGroups.push([]);
                }
                continue;
            }

            if (__leaf_isLowerCaseEnglish(char2)) {
                childLevel++;
                continue;
            }
            continue;
        }

        if (childLevel > 0) {
            continue;
        }

        // top level text
        if (char1 + char2 == '{{') {
            leftToken = i;
            i++;
            continue;
        }

        if (leftToken > -1) {
            if (char1 + char2 == '}}') {
                var tokenOrigin = s.substring(leftToken + 2, i);
                var uniqueID = __leaf_generateID(16);
                template[template.length - 1] += uniqueID;
                tokenGroups[tokenGroups.length - 1].push({
                    templateIndex: template.length - 1,
                    origin: tokenOrigin,
                    uniqueID: uniqueID,
                });
                i++;
                leftToken = -1;
                continue;
            }
            continue;
        }

        template[template.length - 1] += char1;
        if (i >= s.length - 2) {
            template[template.length - 1] += char2;
        }
    }

    for (var i = 0; i < tokenGroups.length; i++) {
        var group = tokenGroups[i];
        for (var j = 0; j < group.length; j++) {
            var token = group[j];
            var observables = __leaf_parseObservablesInToken(token.origin, $);
            (function (templateIndex) {
                for (var k = 0; k < observables.length; k++) {
                    observables[k].__observers.push(function (v) {
                        __leaf_assembleAndReplaceTopLevelInnerText(elem, template, tokenGroups, templateIndex, $);
                    });
                }
            })(token.templateIndex)

        }
    }
    // attributes
    for (var i = 0; i < elem.attributes.length; i++) {
        var name = elem.attributes[i].name;
        if (name.startsWith('l-')) {
            name = name.substring(2);
            var value = '';
            var observables = __leaf_parseObservablesInToken(elem.attributes[i].value, $);
            if (name.startsWith('style-')) {
                value = name.substring(6);
                name = 'style';
            } else if (name.startsWith('class-')) {
                value = name.substring(6);
                name = 'class';
            }
            (function (name, token) {
                var fn = function (name, token) {
                    var result = __leaf_executeToken(token, $);
                    if (name == 'class') {
                        if (result) {
                            __leaf_addClass(elem, value);
                        } else {
                            __leaf_removeClass(elem, value);
                        }
                        return;
                    } else if (name == 'if') {
                        if (result) {
                            elem.style.display = '';
                        } else {
                            elem.style.display = 'none';
                        }
                        return;
                    }
                    if (typeof result == 'boolean') {
                        if (result) {
                            elem.setAttribute(name, value)
                        } else {
                            elem.removeAttribute(name)
                        }
                    } else {
                        elem.setAttribute(name, result)
                    }
                };
                for (var j = 0; j < observables.length; j++) {
                    observables[j].__observers.push(function (v) {
                        fn(name, token);
                    })
                }
                fn(name, token);
            })(name, elem.attributes[i].value)
        }
    }
    // render initial data
    for (var i = 0; i < template.length; i++) {
        __leaf_assembleAndReplaceTopLevelInnerText(elem, template, tokenGroups, i, $)
    }

    // children
    for (var i = 0; i < elem.children.length; i++) {
        __leaf_parse(elem.children[i], $);
    }
    return $;
}

function __leaf_removeClass(elem, className) {
    var s = elem.getAttribute('class');
    if (s && s.indexOf(className) > -1) {
        elem.setAttribute('class', s.replace(className, ''));
    }
    return;
}

function __leaf_addClass(elem, className) {
    var s = elem.getAttribute('class');
    if (!s) {
        s = '';
    }
    if (s.indexOf(className) == -1) {
        elem.setAttribute('class', s + ' ' + className);
    }
    return;
}

function __leaf_executeToken(__leaf_token_origin, $) {
    return eval(__leaf_token_origin);
}

function __leaf_parseObservablesInToken(tokenOrigin, $) {
    var observables = [];
    for (var i = 0; i < tokenOrigin.length - 1; i++) {
        var char1 = tokenOrigin[i];
        var char2 = tokenOrigin[i + 1];
        if (char1 + char2 == '$.') {
            i += 2;
            var variableName = '';
            for (; i < tokenOrigin.length; i++) {
                if (__leaf_isVariableName(tokenOrigin.charAt(i))) {
                    variableName += tokenOrigin.charAt(i);
                } else {
                    break;
                }
            }
            var observable = $[variableName];
            if (!observable || !observable.__observers || !observable.postValue) {
                throw new Error('parse template failed: invalid variable name ' + tokenOrigin);
            }

            observables.push(observable);
        }
    }
    return observables;
}

function __leaf_assembleAndReplaceTopLevelInnerText(elem, template, tokenGroups, templateIndex, $) {
    console.log('assembling: ' + templateIndex);
    var s = elem.innerHTML;
    var childLevel = 0;
    var currentTemplateIndex = 0;
    var builder = '';
    for (var i = 0; i < s.length - 1; i++) {
        var char1 = s.charAt(i);
        var char2 = s.charAt(i + 1);
        if (char1 == '<') {
            builder += char1;
            if (char2 == '/') {
                var foundEnding = false;
                i++;
                for (; i < s.length; i++) {
                    builder += s.charAt(i);
                    if (s.charAt(i) == '>') {
                        foundEnding = true;
                        break;
                    }
                }
                if (!foundEnding) {
                    throw new Error('ending arrow for [</] not found: ' + s.substring(0, i));
                }
                childLevel--;
                if (childLevel == 0) {
                    currentTemplateIndex++;
                }
                continue;
            }

            if (i >= s.length - 2) {
                builder += char2;
            }
            if (__leaf_isLowerCaseEnglish(char2)) {
                childLevel++;
            }
            continue;
        }

        if (childLevel > 0 || currentTemplateIndex != templateIndex) {
            builder += char1;
            if (i >= s.length - 2) {
                builder += char2;
            }
            continue;
        }

        // replace template
        var targetTemplate = template[templateIndex];
        for (var j = 0; j < tokenGroups[templateIndex].length; j++) {
            var token = tokenGroups[templateIndex][j];
            var result = __leaf_executeToken(token.origin, $);
            targetTemplate = targetTemplate.replace(token.uniqueID, result);
        }
        builder += targetTemplate;
        currentTemplateIndex++;
        i++;
        // slipping to current template ending
        for (; i < s.length; i++) {
            var char = s.charAt(i);
            if (char == '<') {
                i--;
                break;
            }
        }
    }
    elem.innerHTML = builder;
}