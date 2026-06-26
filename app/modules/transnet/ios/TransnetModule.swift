import ExpoModulesCore

public class TransnetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Transnet")

    Events("onChange")

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}
