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

        function getValidationState(left, right, operatorDef, dependent) {
            var validationState = null;

            if (!operatorDef.operation(left.value, right.value, left.typeNode, right.typeNode, dependent)) {
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

        function getRightArg(namedArgs, right) {
            var value = namedArgs[right];

            if (typeof value === 'undefined' && typelog.isType(right)) {
                value = buildTypeObj(right);
            }

            return value;
        }

        function checkDependentTypes(namedArgs) {
            return function (dependent, validationState) {
                dependent.leftTokens = dependent.left.split(':');
                dependent.rightTokens = dependent.right.split(':');

                var leftName = dependent.leftTokens[0];
                var left = namedArgs[leftName];
                var rightName = dependent.rightTokens[0];
                var right = getRightArg(namedArgs, rightName);

                var newValidationState = null;

                var namedValuesExist =
                    typeof left !== 'undefined'
                    && typeof right !== 'undefined';

                if (validationState === null && namedValuesExist) {
                    var operatorDef = getDependentOperator(left.typeNode.type, dependent.operator);

                    newValidationState = getValidationState(left, right, operatorDef, dependent);
                }

                return newValidationState === null ? validationState : newValidationState;
            };
        }

        function buildEnvironmentTable(typeList, argumentList, environment) {
            var result = typeof environment === 'undefined' ? {} : environment;
            var typeLength = typeList.length;
            var typeNode;
            var typeName;

            for (var i = 0; i < typeLength; i++) {
                typeNode = typeList[i];
                typeName = typeNode.name;

                if (typeName === null) {
                    continue;
                }

                if (typeof result[typeName] !== 'undefined') {
                    var errorMessage = 'Signet evaluation error: '
                        + 'Cannot overwrite value in existing variable: "'
                        + typeName + '"';
                    throw new Error(errorMessage);
                }

                result[typeName] = {
                    name: typeName,
                    value: argumentList[i],
                    typeNode: typeList[i]
                };
            }

            return result;
        }

        function arrayOrDefault(value) {
            var typeOk = Object.prototype.toString.call(value) === '[object Array]';
            return typeOk ? value : [];
        }

        function validateArguments(typeList, environment) {
            var dependentExpressions = arrayOrDefault(typeList.dependent);

            return function (argumentList) {
                var startingEnvironment = typeof environment === 'undefined'
                    ? typeList.environment
                    : environment;

                var environmentTable = buildEnvironmentTable(typeList, argumentList, startingEnvironment);
                var checkDependentType = checkDependentTypes(environmentTable);

                var validationState = typeList.length === 0 ? null : validateCurrentValue(typeList, argumentList);


                dependentExpressions.forEach(function (dependent) {
                    validationState = checkDependentType(dependent, validationState);
                });

                return validationState;
            };
        }

        return {
            validateArguments: validateArguments,
            validateType: validateType,
            buildEnvironment: buildEnvironmentTable
        };
    };

})();

if (typeof module !== 'undefined' && typeof module.exports !== undefined) {
    module.exports = signetValidator;
}