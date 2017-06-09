var signetValidator = (function () {
    'use strict';

    function first(list) {
        return list[0];
    }

    function rest(list) {
        return list.slice(1);
    }

    return function (typelog, assembler, parser) {

        function validateOptional(typeDef, argument, typeList) {
            return typeDef.optional && (typeList.length > 1 || typeof argument === 'undefined');
        }

        function validateType(typeDef) {
            var hasTypeCheck = typeof typeDef.typeCheck === 'function';
            return hasTypeCheck ? typeDef.typeCheck : typelog.isTypeOf(typeDef);
        }

        function validateCurrentValue(typeList, argumentList) {
            var typeDef = first(typeList);
            var argument = first(argumentList);

            var isValidated = validateType(typeDef)(argument);
            var nextArgs = !isValidated ? argumentList : rest(argumentList);

            var validateNext = validateArguments(rest(typeList));
            var accepted = isValidated || validateOptional(typeDef, argument, typeList);

            return accepted ? validateNext(nextArgs) : [assembler.assembleType(typeDef), argument];
        }

        function getValidationState(left, right, operatorDef) {
            var validationState = null;

            if (!operatorDef.operation(left.value, right.value, left.typeNode, right.typeNode)) {
                var typeInfo = [left.name, operatorDef.operator, right.name];
                var typeDef = typeInfo.join(' ');
                var valueInfo = [left.name, '=', left.value, 'and', right.name, '=', right.value];

                validationState = [typeDef, valueInfo.join(' ')];
            }

            return validationState;
        }

        function alwaysFalse() {
            return false;
        }

        function getDependentOperator(typeName, operator) {
            var dependentOperator = typelog.getDependentOperatorOn(typeName)(operator);

            if (dependentOperator === null) {
                dependentOperator = {
                    operator: operator,
                    operation: alwaysFalse
                };
            }

            return dependentOperator;
        }

        function buildTypeObj(typeName) {
            var typeDef = parser.parseType(typeName);
            var isCorrectType = typelog.isTypeOf(typeDef);

            function typeCheck(value) {
                return isCorrectType(value);
            }

            typeCheck.toString = function () {
                return '[function typePredicate]';
            }

            return {
                name: typeName,
                value: typeCheck,
                typeNode: typeDef
            };

        }

        function buildValueObj(value) {
            return {
                name: value,
                value: value,
                typeNode: {}
            }
        }

        function getRightArg(namedArgs, right) {
            var value = namedArgs[right];

            if (typeof value === 'undefined') {
                value = typelog.isType(right) ? buildTypeObj(right) : buildValueObj(right);
            }

            return value;
        }

        function checkDependentTypes(namedArgs) {
            return function (dependent, validationState) {
                var newValidationState = null;

                if (validationState === null) {
                    var left = namedArgs[dependent.left];
                    var right = getRightArg(namedArgs, dependent.right);

                    var operatorDef = getDependentOperator(left.typeNode.type, dependent.operator);

                    newValidationState = getValidationState(left, right, operatorDef);
                }

                return newValidationState === null ? validationState : newValidationState;
            };
        }

        function buildNamedArgs(typeList, argumentList) {
            var result = {};
            var typeLength = typeList.length;
            var typeNode;
            var typeName;

            for (var i = 0; i < typeLength; i++) {
                typeNode = typeList[i];
                typeName = typeNode.name;
                result[typeName] = {
                    name: typeName,
                    value: argumentList[i],
                    typeNode: typeList[i]
                };
            }

            return result;
        }

        function arrayOrDefault (value) {
            var typeOk = Object.prototype.toString.call(value) === '[object Array]';
            return typeOk ? value : [];
        }

        function validateArguments(typeList) {
            var dependentExpressions = arrayOrDefault(typeList.dependent);

            return function (argumentList) {
                var namedArgs = buildNamedArgs(typeList, argumentList);
                var validationState = typeList.length === 0 ? null : validateCurrentValue(typeList, argumentList);

                var checkDependentType = checkDependentTypes(namedArgs);

                dependentExpressions.forEach(function (dependent) {
                    validationState = checkDependentType(dependent, validationState);
                });

                return validationState;
            };
        }

        return {
            validateArguments: validateArguments,
            validateType: validateType
        };
    };

})();

if (typeof module !== 'undefined' && typeof module.exports !== undefined) {
    module.exports = signetValidator;
}