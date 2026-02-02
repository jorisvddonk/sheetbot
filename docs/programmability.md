# Programmability and Extensibility

SheetBot is designed for easy extension through code modification and external configuration. Key extension points:

## External Extension Points (No Code Modification Required)

- **Library Scripts** (`SHEETBOT_LIBRARY_SEARCH_PATHS`): Add custom task scripts from external directories (see [Library Search Paths](library_search_paths.md))
- **Event Handlers** (`SHEETBOT_EVENTHANDLER_SEARCH_PATHS`): React to task and agent events with custom handlers (see [Event Handlers](event_handlers.md))
- **Init Scripts** (`SHEETBOT_INIT_SEARCH_PATHS`): Run custom initialization code on server startup (see [Initialization System](init_system.md))
- **Custom Middleware** (`SHEETBOT_MIDDLEWARE_SEARCH_PATHS`): Add Express middleware for authentication, logging, CORS, etc. (see [Custom Middleware](custom_middleware.md))

## Code Modification Extension Points

- **Authentication**: Add custom middleware to `main.ts` for auth schemes (e.g., OAuth, LDAP)
- **New Endpoints**: Extend the Express app with additional routes
- **Data Providers**: Implement custom storage backends by extending data provider classes
- **Widgets**: Add new widget types (see [Widgets](widgets.md))
- **Sheet Views**: Customize data presentation with widgets and column structures (see [Sheet Database Table Structure](sheet_db_tablestructure.md))
- **Custom Runners**: Implement new execution environments (see [Agent Runtime Implementation](agent_runtime_implementation.md))
- **Capabilities**: Customize agent matching logic (see [Capabilities](capabilities.md))
- **Distributed Runtime**: Enable distributed task execution (see [Distributed Runtime](Distributed_Runtime.md))

The codebase is structured for straightforward modifications. For most use cases, the external extension points provide sufficient flexibility without requiring code changes.

## Forking vs Extension Points

**Use external extension points when:**
- You want to stay on the main SheetBot release track
- You want to receive upstream updates and bug fixes easily
- Your customizations are self-contained (event handlers, middleware, init scripts)
- You prefer configuration over code modification

**Fork SheetBot when:**
- You need deep integration or architectural changes
- External extension points don't provide sufficient flexibility
- You're comfortable maintaining your own version

**Implications of forking:**
- You become responsible for merging upstream changes
- You maintain your own testing and deployment pipeline
- Bug fixes and features from upstream require manual integration
- You have full control over the codebase

For most users, the external extension points (`SHEETBOT_LIBRARY_SEARCH_PATHS`, `SHEETBOT_EVENTHANDLER_SEARCH_PATHS`, `SHEETBOT_INIT_SEARCH_PATHS`, `SHEETBOT_MIDDLEWARE_SEARCH_PATHS`) provide sufficient customization without the maintenance burden of a fork.

**Important:** SheetBot is provided AS IS without warranty. The maintainer makes no guarantees about backward compatibility, API stability, or continued support for any extension points or internal APIs. Extension points may change or be removed in future versions. Use at your own risk and be prepared to adapt your customizations as the project evolves.