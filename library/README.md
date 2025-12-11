# SheetBot Library - Example Scripts

This directory contains example automation scripts that demonstrate SheetBot's capabilities for various real-world use cases.

## About These Examples

These scripts are **real-world examples** that show how SheetBot can be used for complex automation tasks. They demonstrate:

- **Advanced build automation** - Compiling complex software projects
- **Multi-platform support** - Building for different operating systems and architectures
- **Deployment workflows** - Automating deployment processes
- **System integration** - Interacting with various systems and APIs
- **Game development** - Compiling game engines and assets

## Categories of Examples

### 🎮 Game Development
- **`godot-compile.ts`** - Compiles Godot game engine from source
- **`feltyrion-godot_compile.ts`** - Compiles Feltyrion-Godot game
- **`feltyrion-godot_merge.ts`** - Merges Feltyrion-Godot builds
- **`meta_feltyrion-godot_multios_compilation.ts`** - Multi-OS compilation orchestration

### 🌐 Web Development
- **`mooses_nl_build_deploy.ts`** - Builds and deploys mooses.nl website

### 🔧 System Automation
- **`noctis.ts`** - Noctis system reset functionality
- **`system-reset_screenshot.ts`** - System reset screenshot automation
- **`scancodes.ts`** - VirtualBox scancodes handling

### 📦 Build Systems
- **`tzo-c_compile.ts`** - TZO-C compilation

### 🎯 Basic Examples
- **`basic_example.ts`** - Simple task example
- **`browser_example.ts`** - Browser-based task example
- **`cpu_info_example.py`** - Python example for CPU info
- **`system_info_example.sh`** - Shell script for system info

### 🔗 Distributed Computing
- **`distributed_example.ts`** - Distributed task example
- **`distributed_example_2.ts`** - Advanced distributed example
- **`metatask.ts`** - Meta-task orchestration
- **`meta_noctis_systemreset_comparison.ts`** - Multi-system comparison

## How to Use These Examples

### 1. As Learning Resources
These scripts demonstrate advanced SheetBot usage patterns:
- Complex task orchestration
- Multi-step workflows
- Error handling
- Data submission
- Artefact management

### 2. As Templates
Copy and modify these scripts for your own use cases:
```bash
cp library/godot-compile.ts scripts/my-game-compile.ts
# Then edit the copy for your specific needs
```

### 3. As Inspiration
See how different automation challenges are solved:
- Build system integration
- Deployment automation
- Cross-platform compilation
- System monitoring

## Script Structure

Each script follows a similar pattern:

```typescript
// 1. Import dependencies
import { getData, submitData, uploadArtefactFromFilepath } from "./lib/taskutil.ts";

// 2. Define capabilities (optional)
/*
Suggested capabilitiesSchema for this task: <capabilitiesSchema>
{
  "packages": ["git", "cmake", "clang"]
}
</capabilitiesSchema>
*/

// 3. Helper functions
async function subtask_statusupdate(subtaskname, completed) {
  // Update task status
}

// 4. Main execution
const taskdata = await getData();

// 5. Task logic with status updates
await subtask_statusupdate("build", false);
// ... perform task ...
await subtask_statusupdate("build", true);

// 6. Submit results
await submitData({ result: "success" });
```

## Running Examples

To run an example script:

```bash
# 1. Create a task using the script
deno run --allow-all addtask.ts --script library/basic_example.ts

# 2. Or use the web interface
# - Go to the "Library" page
# - Click "Add Task" on any example
# - Configure task parameters
# - Submit and monitor execution
```

## Contributing Examples

We welcome contributions of new example scripts! Please follow these guidelines:

### Requirements
- Scripts should be **self-contained** and **well-documented**
- Include **capabilitiesSchema** for agent matching
- Use **subtask status updates** for progress tracking
- Handle **errors gracefully**
- Submit **meaningful data** and **artefacts**

### Best Practices
- Add **comments** explaining complex logic
- Use **helper functions** for reusable code
- Include **error handling** with meaningful messages
- Document **assumptions** and **requirements**
- Test thoroughly before submitting

### Submission Process
1. Fork the repository
2. Add your script to the `library/` directory
3. Test your script locally
4. Submit a pull request
5. Include documentation in your PR

## License

All example scripts are licensed under the same license as the main SheetBot project. See the main `LICENSE` file for details.

## Support

For questions about these examples:
- Check the main documentation
- Review the API specification
- Look at similar examples
- Open an issue for specific questions

**Note**: These examples are provided "as-is" and may require adaptation for your specific use case.

---

💡 **Tip**: Start with the basic examples and work your way up to the more complex ones!
🚀 **Pro Tip**: Combine multiple examples to create powerful automation workflows!