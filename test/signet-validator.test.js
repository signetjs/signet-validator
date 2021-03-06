'use strict';

var assert = require('chai').assert;
var signetValidator = require('../index');
var signetRegistrar = require('signet-registrar');
var signetTypelog = require('signet-typelog');
var signetParser = require('signet-parser');
var assembler = require('signet-assembler');

function prettyJson(value) {
    return JSON.stringify(value, null, 4);
}

describe('Signet value type validator', function () {
    require('./utils/approvals.config');

    var registrar;
    var validator;
    var parser;

    beforeEach(function () {
        registrar = signetRegistrar();
        parser = signetParser();
        var typelog = signetTypelog(registrar, parser);

        typelog.define('boolean', function (value) { return typeof value === 'boolean'; });
        typelog.define('string', function (value) { return typeof value === 'string'; });
        typelog.define('number', function (value) { return typeof value === 'number'; });
        typelog.define('object', function (value) { return typeof value === 'object'; });

        typelog.defineDependentOperatorOn('number')('<', function (a, b) { return a < b; });
        typelog.defineDependentOperatorOn('number')('>', function (a, b) { return a > b; });

        typelog.defineDependentOperatorOn('*')('typeof', function (a, typeCheck) {
            return typeCheck(a);
        });

        typelog.defineDependentOperatorOn('*')('teston', function (a, b) { return (a, b, false); });

        validator = signetValidator(typelog, assembler, parser);

        var isNumber = validator.validateType(parser.parseType('number'));

        typelog.defineSubtypeOf('number')('rangedNumber', function (value, options) {
            var min = Number(options[0]);
            var max = Number(options[1]);

            return isNumber(value) && min <= value && value <= max;
        });

        typelog.defineSubtypeOf('number')('int', function (value) {
            return Math.floor(value) === value;
        });
    });

    describe('validateType', function () {

        it('should return true if value is correct type', function () {
            var result = validator.validateType(parser.parseType('string'))('foo');

            assert.strictEqual(result, true);
        });

        it('should return false if value is of incorrect type', function () {
            var result = validator.validateType(parser.parseType('number'))('foo');

            assert.strictEqual(result, false);
        });

    });

    describe('validateArguments', function () {

        it('should return null if all arguments are valid', function () {
            var signatureTree = parser.parseSignature('string, number => object');
            var result = validator.validateArguments(signatureTree[0])(['foo', 5]);

            assert.strictEqual(result, null);
        });

        it('should return type/value tuple if a value fails', function () {
            var signatureTree = parser.parseSignature('string, number => object');
            var result = validator.validateArguments(signatureTree[0])(['foo', 'bar']);

            this.verify(prettyJson(result));
        });

        it('should return full type string on failure', function () {
            var signatureTree = parser.parseSignature('rangedNumber<1;5> => *');
            var result = validator.validateArguments(signatureTree[0])([-3]);

            this.verify(prettyJson(result));
        });

        it('should succeed on optional checks', function () {
            var signatureTree = parser.parseSignature('string, [number] => object');
            var result = validator.validateArguments(signatureTree[0])(['foo']);

            assert.strictEqual(result, null);
        });

        it('should succeed on signature checks with optional subtypes', function () {
            var signatureTree = parser.parseSignature('int, [int] => *');
            var result = validator.validateArguments(signatureTree[0])([5]);

            assert.strictEqual(result, null);
        });

        it('should succeed on signature checks with satisfied optional types and extra arguments', function () {
            var signatureTree = parser.parseSignature('int, [int] => *');
            var result = validator.validateArguments(signatureTree[0])([5, 6, 'foo', true]);

            assert.strictEqual(result, null);
        });

        it('should fail if last argument is optional and type does not match', function () {
            var signatureTree = parser.parseSignature('int, [int] => *');
            var result = validator.validateArguments(signatureTree[0])([5, 'foo']);

            this.verify(prettyJson(result));
        });

        it('should fail if value exists and fails optional check', function () {
            var signatureTree = parser.parseSignature('string, [number], boolean => object');
            var result = validator.validateArguments(signatureTree[0])(['foo', 'bar']);

            this.verify(prettyJson(result));
        });

        it('should fail if values pass, but dependent type check fails', function () {
            var signatureTree = parser.parseSignature('A < B :: A:int, B:int => array<int>');
            var result = validator.validateArguments(signatureTree[0])([6, 5]);

            this.verify(prettyJson(result));
        });

        it('should succeed if dependent types are satisfied', function () {
            var signatureTree = parser.parseSignature('A < B, B < C :: A:int, B:int, C:int => array<int>');
            var result = validator.validateArguments(signatureTree[0])([4, 5, 6]);

            assert.equal(result, null);
        });

        it('should attempt to parse and pass type if value is not a named type', function () {
            var signatureTree = parser.parseSignature('A typeof int, B typeof string :: A:int, B:int => array<int>');
            var result = validator.validateArguments(signatureTree[0])([4, 5]);

            this.verify(prettyJson(result));
        });

        it('should interpret type checks across curried functions', function () {
            var signatureTree = parser.parseSignature('A < B :: A:int => B:int => array<int>');

            signatureTree[1]['environment'] = {
                A: {
                    name: 'A',
                    value: 5,
                    typeNode: parser.parseType('A:int')
                }
            };

            signatureTree[1].dependent = [
                    {
                        left: 'A',
                        right: 'B',
                        operator: '<'
                    }
                ]

            var result = validator.validateArguments(signatureTree[1])([4]);

            this.verify(prettyJson(result));
        });

        it('should pass dependent check when all variables are not yet present', function () {
            var signatureTree = parser.parseSignature('A < B :: A:int => B:int => array<int>');

            var result = validator.validateArguments(signatureTree[0])([4]);

            assert.equal(null, result);
        });

        it('should support directly provided environment table', function () {
            var signatureTree = parser.parseSignature('A < B :: A:int => B:int => array<int>');

            const environmentTable = {
                A: {
                    name: 'A',
                    value: 5,
                    typeNode: parser.parseType('A:int')
                }
            };

            signatureTree[1].dependent = [
                    {
                        left: 'A',
                        right: 'B',
                        operator: '<'
                    }
                ]

            var result = validator.validateArguments(signatureTree[1], environmentTable)([4]);

            this.verify(prettyJson(result));
        });

        it('should throw an error if user tries to mutate an existing variable', function () {
            var signatureTree = parser.parseSignature('A < B :: A:int => A:int => array<int>');

            const environmentTable = {
                A: {
                    name: 'A',
                    value: 5,
                    typeNode: parser.parseType('A:int')
                }
            };

            signatureTree[1].dependent = [
                    {
                        left: 'A',
                        right: 'B',
                        operator: '<'
                    }
                ]

            assert.throws(validator.validateArguments(signatureTree[1], environmentTable).bind(null, [4]));
        });

    });

});

if (typeof global.runQuokkaMochaBdd === 'function') {
    runQuokkaMochaBdd();
}