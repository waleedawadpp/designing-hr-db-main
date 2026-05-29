module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    // يجب أن يكون إضافة react-native-reanimated آخر عنصر في القائمة
    plugins: ["react-native-reanimated/plugin"],
  };
};
