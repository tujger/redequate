import type {StorybookConfig} from "@storybook/react-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import pluginReact from '@vitejs/plugin-react'

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@storybook/addon-onboarding",
        "@storybook/addon-interactions",
        "@chromatic-com/storybook",
    ],
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    docs: {},
    viteFinal: async (config) => {
    //     config.plugins?.push(tsconfigPaths());
        config.plugins?.push(pluginReact({
            babel: {
    //             // presets: [
    //             //     [
    //             //         '@babel/preset-env',
    //             //         {targets: {node: 'current'}}
    //             //     ],
    //             //     "@babel/preset-react",
    //             //     "@babel/preset-typescript",
    //             // ]
                presets: [
    //                 [
    //                     '@babel/preset-env',
    //                             {targets: {node: 'current'}, modules: false}
    //                 ],
                    '@babel/preset-react',
    //                 "@babel/preset-typescript",
                ],
    //             plugins: [
    //                 '@babel/plugin-transform-modules-commonjs',
    //                 '@babel/plugin-proposal-class-properties'
    //             ]
            },
            include: /\.(mdx|js|jsx|ts|tsx)$/
        }));
        return config;
    },
};
export default config;
