#!/usr/bin/env bash
# Build APK Kahfi Party Star tanpa Gradle:
#   resource -> aapt2, kelas -> javac + d8, paket -> zip, tanda tangan -> apksigner
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
JAVA_HOME="${JAVA_HOME:-$ROOT/tools/$(ls "$ROOT/tools" | grep -E '^jdk-17' | head -1)}"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
BT="$ROOT/tools/sdk/build-tools/34.0.0"
AJ="$ROOT/tools/sdk/platforms/android-34/android.jar"
OUT="${1:-$ROOT/kahfi-party-star.apk}"

cd "$ROOT/project"
rm -f "$ROOT/res.zip" "$ROOT/base.apk" "$ROOT/classes.dex" "$ROOT/unsigned.apk" "$ROOT/aligned.apk"
mkdir -p "$ROOT/classes"
find "$ROOT/classes" -type f -name '*.class' -delete

"$BT/aapt2" compile --dir res -o "$ROOT/res.zip"
"$BT/aapt2" link -o "$ROOT/base.apk" -I "$AJ" --manifest AndroidManifest.xml -A assets \
  "$ROOT/res.zip" --min-sdk-version 23 --target-sdk-version 34

"$JAVA_HOME/bin/javac" -source 1.8 -target 1.8 -bootclasspath "$AJ" -nowarn \
  -d "$ROOT/classes" java/com/kahfi/partystar/MainActivity.java
"$BT/d8" --lib "$AJ" --min-api 23 --output "$ROOT" $(find "$ROOT/classes" -name '*.class')

python3 - "$ROOT" <<'PY'
import sys, zipfile, shutil
root = sys.argv[1]
shutil.copy(f'{root}/base.apk', f'{root}/unsigned.apk')
with zipfile.ZipFile(f'{root}/unsigned.apk', 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(f'{root}/classes.dex', 'classes.dex')
PY

if [ ! -f "$ROOT/kps.keystore" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$ROOT/kps.keystore" -storepass kahfi123 \
    -keypass kahfi123 -alias kps -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Kahfi Party Star, O=Kahfi, C=ID" >/dev/null 2>&1
fi

"$BT/zipalign" -f 4 "$ROOT/unsigned.apk" "$ROOT/aligned.apk"
"$BT/apksigner" sign --ks "$ROOT/kps.keystore" --ks-pass pass:kahfi123 --key-pass pass:kahfi123 \
  --out "$OUT" "$ROOT/aligned.apk"
echo "APK siap: $OUT"
