package expo.modules.transnet

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import core.Core
import android.os.Environment
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import android.net.wifi.WifiManager
import android.content.Context

class TransnetModule : Module() {

  private fun resolveFilePaths(filePathsStr: String): String {
      if (filePathsStr.isEmpty()) return ""

      val context = appContext.reactContext ?: throw Exception("React context is null")
      val uris = filePathsStr.split("<|sep|>")

      val realPaths = uris.map { uriString ->
          val trimmed = uriString.trim()

          when {
              trimmed.startsWith("content://") -> {
                  val uri = android.net.Uri.parse(trimmed)

                  val fileName = run {
                      val cursor = context.contentResolver.query(
                          uri,
                          arrayOf(android.provider.OpenableColumns.DISPLAY_NAME),
                          null, null, null
                      )
                      cursor?.use {
                          if (it.moveToFirst()) {
                              it.getString(it.getColumnIndexOrThrow(android.provider.OpenableColumns.DISPLAY_NAME))
                          } else {
                              "transnet_${System.currentTimeMillis()}"
                          }
                      } ?: "transnet_${System.currentTimeMillis()}"
                  }

                  val tempFile = File(context.cacheDir, fileName)

                  // Only copy if the file doesn't already exist to save time
                  if (!tempFile.exists() || tempFile.length() == 0L) {
                      context.contentResolver.openInputStream(uri)?.use { input ->
                          tempFile.outputStream().use { output ->
                              input.copyTo(output)
                          }
                      } ?: throw Exception("Failed to open URI: $trimmed")
                  }

                  tempFile.absolutePath
              }
              trimmed.startsWith("file://") -> trimmed.removePrefix("file://")
              else -> trimmed
          }
      }

      return realPaths.joinToString("<|sep|>")
  }

  override fun definition() = ModuleDefinition {
    Name("Transnet")

    OnDestroy {
      android.util.Log.d("TRANSNET", "App killed. Cleaning up Go routines and ports...")
      try {
        Core.stopServer()
        Core.stopDiscoveryService()
      } catch (e: Exception) {
        android.util.Log.e("TRANSNET", "Cleanup error: ${e.message}")
      }
    }

    Events("onChange")

    AsyncFunction("testBridge") { value: String ->
      val goReply = Core.testGoEngine(value)

      sendEvent("onChange", mapOf(
        "value" to goReply
      ))

      return@AsyncFunction goReply
    }

    AsyncFunction("getLocalIP") { ->
      try {
        return@AsyncFunction Core.getLocalIP()
      } catch (e: Exception) {
        throw Exception("Failed to get IP: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("initCore") { ->
      val context = appContext.reactContext ?: throw Exception("React context is null")
      try {
          Core.initCore(context.filesDir.absolutePath)
          return@AsyncFunction "Core Initialized"
      } catch (e: Exception) {
          throw Exception("Failed to init core: ${e.message}")
      }
    }

    AsyncFunction("initiateFileTransfer") { ->
      try {
        val result = Core.initiateFileTransfer()
        return@AsyncFunction result
      } catch (e: Exception) {
        throw Exception("Failed to initiate transfer: ${e.message ?: "Unknown error"}")
      }
    }
    
    AsyncFunction("listenFileTransfer") { ->
      try {
          val reactContext = appContext.reactContext 
              ?: throw Exception("React context not available")

          val wifiManager = reactContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
          val multicastLock = wifiManager.createMulticastLock("transnet_file_transfer_lock")
          multicastLock.setReferenceCounted(true)
          multicastLock.acquire()

          try {
              val result = Core.listenFileTransfer()
              android.util.Log.d("TRANSNET", "Listen result: $result")
              return@AsyncFunction result
          } catch (e: Exception) {
              throw Exception("Go listen failed: ${e.message ?: "Unknown"}")
          } finally {
              if (multicastLock.isHeld) {
                  multicastLock.release()
              }
          }
      } catch (e: Exception) {
          throw Exception("Failed to listen for transfer: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("stopDiscoveryService") { ->
      try {
        Core.stopDiscoveryService()
        return@AsyncFunction "Discovery stopped"
      } catch (e: Exception) {
        throw Exception("Failed to stop discovery: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("acceptFileTransfer") { senderAddr: String ->
      try {
        Core.acceptFileTransfer(senderAddr)
        return@AsyncFunction "Accepted"
      } catch (e: Exception) {
        throw Exception("Failed to accept transfer: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("startServer") { port: String ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context is null")

        // Use app-specific external storage (no permission needed on Android 10+)
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          ?: throw Exception("Could not access external storage")

        // Create TransNet folder
        val transnetDir = File(downloadsDir, "TransNet")

        if (!transnetDir.exists()) {
          transnetDir.mkdirs()
        }

        val saveDir = transnetDir.absolutePath

        val result = Core.startServer(port, saveDir)

        return@AsyncFunction result

      } catch (e: Exception) {
        throw Exception("Failed to start server: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("stopServer") { ->
      try {
        Core.stopServer()
        return@AsyncFunction "Server stopped"
      } catch (e: Exception) {
        throw Exception("Failed to stop server: ${e.message ?: "Unknown error"}")
      }
    }

     AsyncFunction("sendFile") { ip: String, port: String, filePathsStr: String ->

      android.util.Log.d("TRANSNET", "=== SEND FILE START ===")
      android.util.Log.d("TRANSNET", "ip=$ip")
      android.util.Log.d("TRANSNET", "port=$port")
      android.util.Log.d("TRANSNET", "files=$filePathsStr")
      
      try {
          if (filePathsStr.isEmpty()) {
              throw Exception("No files provided")
          }

          val resolvedPaths = resolveFilePaths(filePathsStr)

          Core.sendFile(
              ip,
              port,
              resolvedPaths
          )

          return@AsyncFunction "File(s) sent successfully!"

      } catch (e: Exception) {
          e.printStackTrace()
          throw e
      }
    }
  }
}