# SIM-RT Mobile Android ProGuard Rules
# Obfuscation & Shrinking for Google Play Release

-keepattributes *Annotation*
-keepclassmembers class * {
    @org.webkit.JavascriptInterface <methods>;
}

-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# Keep native local notifications
-keep class com.capacitorjs.plugins.localnotifications.** { *; }

# Keep camera plugin
-keep class com.capacitorjs.plugins.camera.** { *; }
