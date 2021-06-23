import babel from 'rollup-plugin-babel';

export default {
	external: [
		'typed-binary-json'
	],
	input: 'src/TbjsonHandler.js',
	output: {
		exports: 'auto',
		file: 'lib/index.js',
		format: 'cjs'
	},
	plugins: [
		babel({
			exclude: 'node_modules/**'
		})
	]
};