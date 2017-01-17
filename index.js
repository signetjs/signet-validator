var signetValidator = (function () {
    'use strict';

    function first(list) {
        return list[0];
    }

    function rest(list) {
        return list.slice(1);
    }

    return function (typelog, assembler) {

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

        function validateArguments(typeList) {
            return function (argumentList) {
                return typeList.length === 0 ? null : validateCurrentValue(typeList, argumentList);
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