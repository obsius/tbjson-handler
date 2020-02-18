import babel from 'rollup-plugin-babel';

export default {
	external: [
		'tbjson'
	],
	input: 'src/TbjsonHandler.js',
	output: {
		file: 'lib/index.js',
		format: 'cjs'
	},
	plugins: [
		babel({
			exclude: 'node_modules/**'
		})
	]
};