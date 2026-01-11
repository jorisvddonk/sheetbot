# Programmability and Extensibility

SheetBot is designed for easy extension through code modification. Key extension points:

- **Authentication**: Add custom middleware to `main.ts` for auth schemes (e.g., OAuth, LDAP)
- **New Endpoints**: Extend the Express app with additional routes
- **Data Providers**: Implement custom storage backends by extending data provider classes
- **Widgets**: Add new widget types (see [Widgets](widgets.md))
- **Sheet Views**: Customize data presentation with widgets and column structures (see [Sheet Database Table Structure](sheet_db_tablestructure.md))
- **Custom Runners**: Implement new execution environments (see [Agent Runtime Implementation](agent_runtime_implementation.md))
- **Capabilities**: Customize agent matching logic (see [Capabilities](capabilities.md))
- **Distributed Runtime**: Enable distributed task execution (see [Distributed Runtime](Distributed_Runtime.md))

The codebase is structured for straightforward modifications. For authentication, simply insert relevant middleware before route definitions in `main.ts`.