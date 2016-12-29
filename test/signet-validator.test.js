'use strict';

var assert = require('chai').assert;
var signetValidator = require('../index');
var signetRegistrar = require('signet-registrar');
var signetTypelog = require('signet-typelog');
var parser = require('signet-parser');
var assembler = require('signet-assembler');
var approvals = require('./utils/approvals.config');

function prettyJson(value) {
    return JSON.stringify(value, null, 4);
}

describe('Signet value type validator', function () {

    var registrar;
    var validator;

    beforeEach(function () {
        registrar = signetRegistrar();
        var typelog = signetTypelog(registrar, parser);

        typelog.define('string', function (value) { return typeof value === 'string'; });
        typelog.define('number', function (value) { return typeof value === 'number'; });
        typelog.define('object', function (value) { return typeof value === 'object'; });


        validator = signetValidator(typelog, assembler);

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

        it('should fail if value exists and fails optional check', function () {
            var signatureTree = parser.parseSignature('string, [number] => object');
            var result = validator.validateArguments(signatureTree[0])(['foo', 'bar']);

            this.verify(prettyJson(result));
        });

        it('should return full type string on failure', function () {
            var signatureTree = parser.parseSignature('rangedNumber<1;5> => *');
            var result = validator.validateArguments(signatureTree[0])([-3]);

            this.verify(prettyJson(result));
        });

    });

});