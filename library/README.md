# SheetBot Library - Example Scripts

This directory contains example automation scripts that demonstrate SheetBot's capabilities for various real-world use cases.

## About These Examples

These scripts are **real-world examples** that show how SheetBot can be used for complex automation tasks. They demonstrate:

- **Advanced build automation** - Compiling complex software projects
- **Multi-platform support** - Building for different operating systems and architectures
- **Deployment workflows** - Automating deployment processes
- **System integration** - Interacting with various systems and APIs
- **Game development** - Compiling game engines and assets

## Available Examples

### 🎮 Game Development
- **`godot-compile.ts`** - Compiles Godot game engine from source with configurable branches and build flags

### 🌐 Web Automation
- **`browser_example.ts`** - Browser-based automation with screenshot capture

### 📊 System Monitoring
- **`cpu_info_example.py`** - Python script for collecting CPU information and frequency data
- **`system_info_example.sh`** - Shell script for system monitoring (load averages, disk, memory)

### 🎯 Basic Examples
- **`basic_git_example.ts`** - Basic example showing git version detection and data submission
- **`clock_example.ts`** - Generates an SVG analog clock HTML page with current time and uploads as artefact
- **`hello_world.ts`** - Minimal example that stores a timestamped "hello world" message
- **`deno_counter_example.ts`** - Incrementing counter with automatic reset via task transitions

## How to Use These Examples

### 1. As Learning Resources
These scripts demonstrate SheetBot usage patterns:
- Basic task execution and data handling
- Different language runtimes (TypeScript, Python, Shell)
- Sheet data submission and management
- Browser automation and screenshot capture
- System monitoring and reporting
- Automatic task state transitions and self-resetting tasks

### 2. As Templates
Copy and modify these scripts for your own use cases:
```bash
cp library/godot-compile.ts scripts/my-game-compile.ts
# Then edit the copy for your specific needs
```

### 3. As Inspiration
See how different automation challenges are solved:
- Game engine compilation
- Browser automation
- System monitoring and reporting
- Cross-language scripting (TypeScript, Python, Shell)

## Script Structure

Each script follows a similar pattern:

```typescript
// 1. Import dependencies
import { getData, submitData } from "./lib/taskutil.ts";
import { addSheetData } from "./lib/sheetutil.ts";

// 2. Define metadata (optional)
// See docs/library_script_annotations.md for annotation details

// 3. Main execution
const taskdata = await getData();

// 4. Task logic
// ... perform work ...

// 5. Submit results
await submitData({ result: "success" });
await addSheetData("sheet_name", { key: "entry_key", data: result });
```

Scripts can include optional XML-like annotations for task metadata. See [Library Script Annotations](docs/library_script_annotations.md) for complete details on `<name>`, `<capabilitiesSchema>`, `<data>`, and `<addTaskComments>` annotations.

## Running Examples

To run an example script:

```bash
# 1. Create a task using the script
deno run --allow-all addtask.ts --script library/hello_world.ts

# 2. Or use the web interface
# - Go to the "Library" page
# - Click "Add Task" on any example
# - Configure task parameters
# - Submit and monitor execution

# 3. Run an agent to execute tasks
# Set environment variables for authentication:
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password
export SHEETBOT_BASEURL=http://localhost:3000

# Then run a Deno agent:
deno run --reload -A ${SHEETBOT_BASEURL}/scripts/agent.ts
```

## Important note for Import Paths in Deno library scripts

Library scripts for `.ts` files may contain import statements that appear incorrect from a filesystem perspective, such as `import { getData } from "./lib/taskutil.ts"`. These imports are valid because when scripts are served by the SheetBot server, they are accessed under the `/scripts/` URL path, making relative imports resolve correctly.

## Contributing Examples

We welcome contributions of new example scripts! Please follow these guidelines:

### Requirements
- Scripts should be **self-contained** and **well-documented**
- Include **capabilitiesSchema** for agent matching (see [Capabilities System](docs/capabilities.md))
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

💡 **Tip**: Start with `hello_world.ts` for the simplest example, then try `deno_counter_example.ts` to see automatic task transitions in action!
🚀 **Pro Tip**: Use these examples as building blocks for your own automation workflows!