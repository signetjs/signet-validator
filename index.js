var signetValidator = (function () {
    'use strict';

    function first(list) {
        return list[0];
    }

    function rest(list) {
        return list.slice(1);
    }

    return function (typelog, assembler) {

        function validateType (typeDef){
            return typelog.isTypeOf(typeDef);
        }

        function validateArguments(typeList) {
            return function (argumentList) {
                var typeDef = first(typeList);
                var argument = first(argumentList);

                if(typeList.length === 0 && argumentList.length === 0) {
                    return null;
                } else if(typeList.length === 0 && argumentList.lenth !== 0) {
                    return ['invalidArgument', argument];
                } else if (validateType(typeDef)(argument)){
                    return validateArguments(rest(typeList))(rest(argumentList));
                } else if(typeDef.optional) {
                    return validateArguments(rest(typeList))(argumentList);
                } else {
                    return [assembler.assembleType(typeDef), argument];
                }
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