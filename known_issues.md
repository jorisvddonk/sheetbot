# Known issues

* If you submit an ephemeral task and then a task that depends on the ephemeral task, BUT the ephemeral task got completed before you submitted the second task, the second task will never complete, as it has a dependency on a task that isn't in the database anymore. This is because dependsOn is no longer getting checked when inserting a task.
