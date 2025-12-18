@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
if "%MAVEN_PROJECTBASEDIR:~-1%"=="\" set MAVEN_PROJECTBASEDIR=%MAVEN_PROJECTBASEDIR:~0,-1%
set WRAPPER_DIR=%MAVEN_PROJECTBASEDIR%\.mvn\wrapper
set WRAPPER_JAR=%WRAPPER_DIR%\maven-wrapper.jar

if not exist "%WRAPPER_JAR%" (
  if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"
  echo Downloading maven-wrapper.jar ...
  javac "%WRAPPER_DIR%\MavenWrapperDownloader.java" >NUL 2>&1
  java -cp "%WRAPPER_DIR%" MavenWrapperDownloader "%MAVEN_PROJECTBASEDIR%"
)

set MAVEN_OPTS=%MAVEN_OPTS%
java %MAVEN_OPTS% -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain -Dmaven.multiModuleProjectDirectory="%MAVEN_PROJECTBASEDIR%" %*

endlocal
