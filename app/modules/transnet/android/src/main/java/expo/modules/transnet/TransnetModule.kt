package expo.modules.transnet

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import core.Core
import android.os.Environment
import android.os.Build
import android.provider.Settings
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import android.net.wifi.WifiManager
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider

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

    AsyncFunction("getClientProgress") { ->
      try {
        return@AsyncFunction Core.getClientProgressStr()
      } catch (e: Exception) {
        throw Exception("Failed to get client progress: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("getServerProgress") { ->
      try {
        return@AsyncFunction Core.getServerProgressStr()
      } catch (e: Exception) {
        throw Exception("Failed to get server progress: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("getClientStatus") { ->
      try {
        return@AsyncFunction Core.getClientStatus()
      } catch (e: Exception) {
        throw Exception("Failed to get client status: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("getServerStatus") { ->
      try {
        return@AsyncFunction Core.getServerStatus()
      } catch (e: Exception) {
        throw Exception("Failed to get server status: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("cancelClientTransfer") { ->
      try {
        Core.cancelClientTransfer()
        return@AsyncFunction "Client transfer cancelled"
      } catch (e: Exception) {
        throw Exception("Failed to cancel client transfer: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("cancelServerTransfer") { ->
      try {
        Core.cancelServerTransfer()
        return@AsyncFunction "Server transfer cancelled"
      } catch (e: Exception) {
        throw Exception("Failed to cancel server transfer: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("signalSkipCurrentFile") { ->
      try {
        Core.signalSkipCurrentFile()
        return@AsyncFunction "Skip signalled"
      } catch (e: Exception) {
        throw Exception("Failed to signal skip: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("listReceivedFiles") { ->
      try {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          ?: throw Exception("Could not access external storage")
        val transnetDir = File(downloadsDir, "TransNet")

        if (!transnetDir.exists() || !transnetDir.isDirectory) {
          return@AsyncFunction ""
        }

        val files = transnetDir.listFiles()
          ?.filter { it.isFile && !it.name.endsWith(".part") && !it.name.startsWith(".") && !it.name.startsWith(".trashed-") }
          ?.sortedByDescending { it.lastModified() }
          ?: emptyList()

        val result = files.joinToString("<|sep|>") { f ->
          "${f.name}<|sep|>${f.length()}"
        }

        return@AsyncFunction result
      } catch (e: Exception) {
        throw Exception("Failed to list files: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("openFile") { fileName: String ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context is null")
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          ?: throw Exception("Could not access external storage")
        val file = File(File(downloadsDir, "TransNet"), fileName)

        if (!file.exists()) {
          throw Exception("File not found: $fileName")
        }

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

        var mimeType = context.contentResolver.getType(uri)
        if (mimeType == null) {
          mimeType = android.webkit.MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(fileName.substringAfterLast('.', "").lowercase())
            ?: "application/octet-stream"
        }

        val intent = Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, mimeType)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(Intent.createChooser(intent, "Open with").apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        return@AsyncFunction "Opened"
      } catch (e: Exception) {
        throw Exception("Failed to open file: ${e.message ?: "Unknown error"}")
      }
    }

    AsyncFunction("isExternalStorageManager") { ->
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          return@AsyncFunction Environment.isExternalStorageManager()
        }
        val context = appContext.reactContext ?: throw Exception("React context is null")
        val permission = android.Manifest.permission.READ_EXTERNAL_STORAGE
        val granted = context.checkSelfPermission(permission)
        return@AsyncFunction granted == android.content.pm.PackageManager.PERMISSION_GRANTED
      } catch (e: Exception) {
        return@AsyncFunction false
      }
    }

    AsyncFunction("requestExternalStorageManager") { ->
      try {
        val context = appContext.reactContext ?: throw Exception("React context is null")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
        } else {
          val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
        }
        return@AsyncFunction "Permission request opened"
      } catch (e: Exception) {
        throw Exception("Failed to open permission settings: ${e.message ?: "Unknown error"}")
      }
    }
  }
}