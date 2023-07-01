function createValue(value) {
    return {
        __observers: [],
        update: function (v) {
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
    return __leaf_parseTopLevelInnerText(document.getElementById(elemID), $);
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

function __leaf_parseTopLevelInnerText(elem, $) {
    var s = elem.innerHTML;
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

    // render initial data
    for (var i = 0; i < template.length; i++) {
        __leaf_assembleAndReplaceTopLevelInnerText(elem, template, tokenGroups, i, $)
    }

    console.log(tokenGroups);
    return $;
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
            if (!observable || !observable.__observers || !observable.update) {
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