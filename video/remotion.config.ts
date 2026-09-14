import { Config } from "@remotion/cli/config";
import { makeWebpackOverride } from "./webpack-override.mjs";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(18);
// The npm scripts run from this directory.
Config.overrideWebpackConfig(makeWebpackOverride(process.cwd()));
