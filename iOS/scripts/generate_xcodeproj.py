#!/usr/bin/env python3
"""Generate ParentLock.xcodeproj/project.pbxproj without XcodeGen."""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "ParentLock.xcodeproj"


def uid(*parts: str) -> str:
    digest = hashlib.sha1("::".join(parts).encode()).hexdigest().upper()
    return digest[:24]


SWIFT_FILES = {
    "ParentLockShared": sorted((ROOT / "ParentLockShared").glob("*.swift")),
    "ParentLock": sorted(
        p
        for p in (ROOT / "ParentLock").rglob("*.swift")
        if p.is_file()
    ),
    "ParentLockMonitor": sorted((ROOT / "ParentLockMonitor").glob("*.swift")),
    "ParentLockShieldConfig": sorted((ROOT / "ParentLockShieldConfig").glob("*.swift")),
    "ParentLockShieldAction": sorted((ROOT / "ParentLockShieldAction").glob("*.swift")),
    "ParentLockNotificationService": sorted(
        (ROOT / "ParentLockNotificationService").glob("*.swift")
    ),
}

RESOURCES = [
    ROOT / "ParentLock/Resources/Assets.xcassets",
    ROOT / "ParentLock/Resources/Info.plist",
    ROOT / "ParentLock/Resources/ParentLock.entitlements",
    ROOT / "ParentLock/GoogleService-Info.plist.example",
]

FRAMEWORK_PRODUCT = "ParentLockShared.framework"
APP_PRODUCT = "ParentLock.app"
EXT_PRODUCTS = {
    "ParentLockMonitor": "ParentLockMonitor.appex",
    "ParentLockShieldConfig": "ParentLockShieldConfig.appex",
    "ParentLockShieldAction": "ParentLockShieldAction.appex",
    "ParentLockNotificationService": "ParentLockNotificationService.appex",
}

FIREBASE_PRODUCTS = [
    "FirebaseAuth",
    "FirebaseCore",
    "FirebaseFirestore",
    "FirebaseFunctions",
    "FirebaseMessaging",
]


def file_ref(path: Path, last_known: str) -> tuple[str, str]:
    ident = uid("file", str(path.relative_to(ROOT)))
    rel = path.relative_to(ROOT).as_posix()
    name = path.name
    line = (
        f'\t\t{ident} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {last_known}; '
        f'path = {quote(rel if "/" not in rel else name)}; sourceTree = "<group>"; }};'
    )
    # Groups set path; file refs inside a group should use the filename only
    # when the group has a path. We emit filename-only here and rely on groups.
    line = (
        f'\t\t{ident} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {last_known}; '
        f"path = {quote(name)}; sourceTree = \"<group>\"; }};"
    )
    return ident, line


def quote(value: str) -> str:
    if any(ch in value for ch in " -+@{}()"):
        return f'"{value}"'
    return value


def last_known_for(path: Path) -> str:
    if path.suffix == ".swift":
        return "sourcecode.swift"
    if path.suffix == ".plist":
        return "text.plist.xml"
    if path.suffix == ".entitlements":
        return "text.plist.entitlements"
    if path.suffix == ".example":
        return "text.plist.xml"
    if path.suffix == ".xcassets":
        return "folder.assetcatalog"
    return "text"


def build_settings(kind: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    common = {
        "ALWAYS_SEARCH_USER_PATHS": "NO",
        "CLANG_ENABLE_MODULES": "YES",
        "CLANG_ENABLE_OBJC_ARC": "YES",
        "ENABLE_STRICT_OBJC_MSGSEND": "YES",
        "GCC_NO_COMMON_BLOCKS": "YES",
        "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
        "SDKROOT": "iphoneos",
        "SWIFT_VERSION": "5.10",
        "TARGETED_DEVICE_FAMILY": "1,2",
        "CURRENT_PROJECT_VERSION": "1",
        "MARKETING_VERSION": "1.0",
        "CODE_SIGN_STYLE": "Automatic",
        "ENABLE_USER_SCRIPT_SANDBOXING": "YES",
    }
    if kind == "debug":
        common.update(
            {
                "DEBUG_INFORMATION_FORMAT": "dwarf",
                "ENABLE_TESTABILITY": "YES",
                "GCC_DYNAMIC_NO_PIC": "NO",
                "GCC_OPTIMIZATION_LEVEL": "0",
                "ONLY_ACTIVE_ARCH": "YES",
                "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG",
                "SWIFT_OPTIMIZATION_LEVEL": "-Onone",
                "MTL_ENABLE_DEBUG_INFO": "INCLUDE_SOURCE",
            }
        )
    else:
        common.update(
            {
                "DEBUG_INFORMATION_FORMAT": "dwarf-with-dsym",
                "SWIFT_COMPILATION_MODE": "wholemodule",
                "SWIFT_OPTIMIZATION_LEVEL": "-O",
                "VALIDATE_PRODUCT": "YES",
                "MTL_ENABLE_DEBUG_INFO": "NO",
            }
        )
    if extra:
        common.update(extra)
    return common


def settings_block(settings: dict[str, str]) -> str:
    lines = ["\t\t\t\tbuildSettings = {"]
    for key in sorted(settings):
        lines.append(f"\t\t\t\t\t{key} = {quote(settings[key])};")
    lines.append("\t\t\t\t};")
    return "\n".join(lines)


def main() -> None:
    file_refs: list[str] = []
    build_files: list[str] = []
    groups: list[str] = []

    # Product file refs
    products = {}
    products["ParentLockShared"] = uid("product", FRAMEWORK_PRODUCT)
    file_refs.append(
        f'\t\t{products["ParentLockShared"]} /* {FRAMEWORK_PRODUCT} */ = '
        f'{{isa = PBXFileReference; explicitFileType = wrapper.framework; includeInIndex = 0; '
        f'path = {FRAMEWORK_PRODUCT}; sourceTree = BUILT_PRODUCTS_DIR; }};'
    )
    products["ParentLock"] = uid("product", APP_PRODUCT)
    file_refs.append(
        f'\t\t{products["ParentLock"]} /* {APP_PRODUCT} */ = '
        f'{{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; '
        f'path = {APP_PRODUCT}; sourceTree = BUILT_PRODUCTS_DIR; }};'
    )
    for name, product in EXT_PRODUCTS.items():
        products[name] = uid("product", product)
        file_refs.append(
            f"\t\t{products[name]} /* {product} */ = "
            f"{{isa = PBXFileReference; explicitFileType = \"wrapper.app-extension\"; includeInIndex = 0; "
            f"path = {product}; sourceTree = BUILT_PRODUCTS_DIR; }};"
        )

    source_ids: dict[str, list[str]] = {k: [] for k in SWIFT_FILES}
    resource_ids: list[str] = []

    def add_source(target: str, path: Path) -> str:
        ident, line = file_ref(path, last_known_for(path))
        file_refs.append(line)
        build_id = uid("build", target, str(path))
        build_files.append(
            f"\t\t{build_id} /* {path.name} in Sources */ = "
            f"{{isa = PBXBuildFile; fileRef = {ident} /* {path.name} */; }};"
        )
        source_ids[target].append(build_id)
        return ident

    # Shared group
    shared_file_ids = []
    for path in SWIFT_FILES["ParentLockShared"]:
        shared_file_ids.append(add_source("ParentLockShared", path))
    shared_ent = ROOT / "ParentLockShared/ParentLockShared.entitlements"
    shared_ent_id, shared_ent_line = file_ref(shared_ent, last_known_for(shared_ent))
    file_refs.append(shared_ent_line)
    shared_file_ids.append(shared_ent_id)

    shared_group = uid("group", "ParentLockShared")
    groups.append(
        f"\t\t{shared_group} /* ParentLockShared */ = {{\n"
        f"\t\t\tisa = PBXGroup;\n"
        f"\t\t\tchildren = (\n"
        + "".join(f"\t\t\t\t{i},\n" for i in shared_file_ids)
        + "\t\t\t);\n"
        f"\t\t\tpath = ParentLockShared;\n"
        f'\t\t\tsourceTree = "<group>";\n'
        f"\t\t}};"
    )

    # App sources grouped by folder
    app_root = ROOT / "ParentLock"
    app_groups_ids = []
    folder_children: dict[str, list[str]] = {}
    for path in SWIFT_FILES["ParentLock"]:
        ident = add_source("ParentLock", path)
        rel = path.relative_to(app_root).as_posix()
        folder = str(Path(rel).parent)
        folder_children.setdefault(folder, []).append(ident)

    # Resource file refs
    assets = ROOT / "ParentLock/Resources/Assets.xcassets"
    assets_id, assets_line = file_ref(assets, "folder.assetcatalog")
    file_refs.append(assets_line)
    assets_build = uid("build", "resource", "assets")
    build_files.append(
        f"\t\t{assets_build} /* Assets.xcassets in Resources */ = "
        f"{{isa = PBXBuildFile; fileRef = {assets_id} /* Assets.xcassets */; }};"
    )
    resource_ids.append(assets_build)

    info_plist = ROOT / "ParentLock/Resources/Info.plist"
    info_id, info_line = file_ref(info_plist, last_known_for(info_plist))
    file_refs.append(info_line)

    app_ent = ROOT / "ParentLock/Resources/ParentLock.entitlements"
    app_ent_id, app_ent_line = file_ref(app_ent, last_known_for(app_ent))
    file_refs.append(app_ent_line)

    example_plist = ROOT / "ParentLock/GoogleService-Info.plist.example"
    example_id, example_line = file_ref(example_plist, last_known_for(example_plist))
    file_refs.append(example_line)

    folder_children.setdefault("Resources", []).extend([assets_id, info_id, app_ent_id])
    folder_children.setdefault(".", []).append(example_id)

    nested_group_ids = {}
    for folder, children in sorted(folder_children.items()):
        if folder == ".":
            continue
        gid = uid("group", "ParentLock", folder)
        nested_group_ids[folder] = gid
        name = Path(folder).name
        path_line = f"\t\t\tpath = {quote(name)};\n"
        groups.append(
            f"\t\t{gid} /* {name} */ = {{\n"
            f"\t\t\tisa = PBXGroup;\n"
            f"\t\t\tchildren = (\n"
            + "".join(f"\t\t\t\t{c},\n" for c in children)
            + "\t\t\t);\n"
            + path_line
            + '\t\t\tsourceTree = "<group>";\n'
            f"\t\t}};"
        )

    # Feature subgroups live under Features/
    app_top_children = folder_children.get(".", [])[:]
    for folder, gid in nested_group_ids.items():
        parent = str(Path(folder).parent)
        if parent == ".":
            app_top_children.append(gid)

    features_subs = [
        gid
        for folder, gid in nested_group_ids.items()
        if folder.startswith("Features/") and folder.count("/") == 1
    ]
    feat_files = folder_children.get("Features", [])
    if features_subs or feat_files:
        feat_id = nested_group_ids.get("Features") or uid("group", "ParentLock", "Features")
        groups[:] = [g for g in groups if not g.startswith(f"\t\t{feat_id} ")]
        groups.append(
            f"\t\t{feat_id} /* Features */ = {{\n"
            f"\t\t\tisa = PBXGroup;\n"
            f"\t\t\tchildren = (\n"
            + "".join(f"\t\t\t\t{c},\n" for c in feat_files + features_subs)
            + "\t\t\t);\n"
            f"\t\t\tpath = Features;\n"
            '\t\t\tsourceTree = "<group>";\n'
            f"\t\t}};"
        )
        if feat_id not in app_top_children:
            app_top_children.append(feat_id)

    app_group = uid("group", "ParentLock")
    groups.append(
        f"\t\t{app_group} /* ParentLock */ = {{\n"
        f"\t\t\tisa = PBXGroup;\n"
        f"\t\t\tchildren = (\n"
        + "".join(f"\t\t\t\t{c},\n" for c in app_top_children)
        + "\t\t\t);\n"
        f"\t\t\tpath = ParentLock;\n"
        '\t\t\tsourceTree = "<group>";\n'
        f"\t\t}};"
    )

    ext_groups = {}
    for name in EXT_PRODUCTS:
        ids = []
        for path in SWIFT_FILES[name]:
            ids.append(add_source(name, path))
        plist = ROOT / name / "Info.plist"
        plist_id, plist_line = file_ref(plist, last_known_for(plist))
        file_refs.append(plist_line)
        ids.append(plist_id)
        ent = next((ROOT / name).glob("*.entitlements"))
        ent_id, ent_line = file_ref(ent, last_known_for(ent))
        file_refs.append(ent_line)
        ids.append(ent_id)
        gid = uid("group", name)
        ext_groups[name] = gid
        groups.append(
            f"\t\t{gid} /* {name} */ = {{\n"
            f"\t\t\tisa = PBXGroup;\n"
            f"\t\t\tchildren = (\n"
            + "".join(f"\t\t\t\t{i},\n" for i in ids)
            + "\t\t\t);\n"
            f"\t\t\tpath = {name};\n"
            '\t\t\tsourceTree = "<group>";\n'
            f"\t\t}};"
        )

    products_group = uid("group", "Products")
    groups.append(
        f"\t\t{products_group} /* Products */ = {{\n"
        f"\t\t\tisa = PBXGroup;\n"
        f"\t\t\tchildren = (\n"
        + "".join(f"\t\t\t\t{products[n]},\n" for n in ["ParentLock", "ParentLockShared", *EXT_PRODUCTS])
        + "\t\t\t);\n"
        f"\t\t\tname = Products;\n"
        '\t\t\tsourceTree = "<group>";\n'
        f"\t\t}};"
    )

    main_group = uid("group", "main")
    groups.append(
        f"\t\t{main_group} = {{\n"
        f"\t\t\tisa = PBXGroup;\n"
        f"\t\t\tchildren = (\n"
        f"\t\t\t\t{app_group},\n"
        f"\t\t\t\t{shared_group},\n"
        + "".join(f"\t\t\t\t{ext_groups[n]},\n" for n in EXT_PRODUCTS)
        + f"\t\t\t\t{products_group},\n"
        + "\t\t\t);\n"
        '\t\t\tsourceTree = "<group>";\n'
        f"\t\t}};"
    )

    # Package refs
    package_ref = uid("package", "firebase-ios-sdk")
    product_deps = {}
    for product in FIREBASE_PRODUCTS:
        pid = uid("spm", product)
        product_deps[product] = pid

    # Link shared framework into app + extensions
    shared_link_files = {}
    for target in ["ParentLock", *EXT_PRODUCTS]:
        bid = uid("link", target, "ParentLockShared")
        shared_link_files[target] = bid
        build_files.append(
            f"\t\t{bid} /* ParentLockShared.framework in Frameworks */ = "
            f"{{isa = PBXBuildFile; fileRef = {products['ParentLockShared']} /* {FRAMEWORK_PRODUCT} */; }};"
        )

    embed_framework = uid("embed", "ParentLockShared")
    build_files.append(
        f"\t\t{embed_framework} /* ParentLockShared.framework in Embed Frameworks */ = "
        f"{{isa = PBXBuildFile; fileRef = {products['ParentLockShared']} /* {FRAMEWORK_PRODUCT} */; "
        f"settings = {{ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy, ); }}; }};"
    )

    embed_exts = {}
    for name, product in EXT_PRODUCTS.items():
        bid = uid("embed", name)
        embed_exts[name] = bid
        build_files.append(
            f"\t\t{bid} /* {product} in Embed Foundation Extensions */ = "
            f"{{isa = PBXBuildFile; fileRef = {products[name]} /* {product} */; "
            f"settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};"
        )

    firebase_build = {}
    for product in FIREBASE_PRODUCTS:
        bid = uid("link", "app", product)
        firebase_build[product] = bid
        build_files.append(
            f"\t\t{bid} /* {product} in Frameworks */ = "
            f"{{isa = PBXBuildFile; productRef = {product_deps[product]} /* {product} */; }};"
        )

    def sources_phase(target: str) -> str:
        phase = uid("phase", "sources", target)
        return phase, (
            f"\t\t{phase} /* Sources */ = {{\n"
            f"\t\t\tisa = PBXSourcesBuildPhase;\n"
            f"\t\t\tbuildActionMask = 2147483647;\n"
            f"\t\t\tfiles = (\n"
            + "".join(f"\t\t\t\t{i},\n" for i in source_ids[target])
            + "\t\t\t);\n"
            f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
            f"\t\t}};"
        )

    def frameworks_phase(target: str, extras: list[str]) -> tuple[str, str]:
        phase = uid("phase", "frameworks", target)
        files = [shared_link_files[target], *extras] if target in shared_link_files else extras
        return phase, (
            f"\t\t{phase} /* Frameworks */ = {{\n"
            f"\t\t\tisa = PBXFrameworksBuildPhase;\n"
            f"\t\t\tbuildActionMask = 2147483647;\n"
            f"\t\t\tfiles = (\n"
            + "".join(f"\t\t\t\t{i},\n" for i in files)
            + "\t\t\t);\n"
            f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
            f"\t\t}};"
        )

    phases: list[str] = []
    source_phases = {}
    framework_phases = {}
    for target in ["ParentLockShared", "ParentLock", *EXT_PRODUCTS]:
        sid, sblock = sources_phase(target)
        source_phases[target] = sid
        phases.append(sblock)

    # Shared has no shared_link
    shared_fw_phase = uid("phase", "frameworks", "ParentLockShared")
    framework_phases["ParentLockShared"] = shared_fw_phase
    phases.append(
        f"\t\t{shared_fw_phase} /* Frameworks */ = {{\n"
        f"\t\t\tisa = PBXFrameworksBuildPhase;\n"
        f"\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        f"\t\t\t);\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
        f"\t\t}};"
    )

    app_fw, app_fw_block = frameworks_phase("ParentLock", list(firebase_build.values()))
    framework_phases["ParentLock"] = app_fw
    phases.append(app_fw_block)
    for name in EXT_PRODUCTS:
        fid, fblock = frameworks_phase(name, [])
        framework_phases[name] = fid
        phases.append(fblock)

    resources_phase = uid("phase", "resources", "ParentLock")
    phases.append(
        f"\t\t{resources_phase} /* Resources */ = {{\n"
        f"\t\t\tisa = PBXResourcesBuildPhase;\n"
        f"\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        + "".join(f"\t\t\t\t{i},\n" for i in resource_ids)
        + "\t\t\t);\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
        f"\t\t}};"
    )

    embed_fw_phase = uid("phase", "embedfw", "ParentLock")
    phases.append(
        f"\t\t{embed_fw_phase} /* Embed Frameworks */ = {{\n"
        f"\t\t\tisa = PBXCopyFilesBuildPhase;\n"
        f"\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tdstPath = \"\";\n"
        f"\t\t\tdstSubfolderSpec = 10;\n"
        f"\t\t\tfiles = (\n"
        f"\t\t\t\t{embed_framework},\n"
        f"\t\t\t);\n"
        f"\t\t\tname = \"Embed Frameworks\";\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
        f"\t\t}};"
    )

    embed_ext_phase = uid("phase", "embedext", "ParentLock")
    phases.append(
        f"\t\t{embed_ext_phase} /* Embed Foundation Extensions */ = {{\n"
        f"\t\t\tisa = PBXCopyFilesBuildPhase;\n"
        f"\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tdstPath = \"\";\n"
        f"\t\t\tdstSubfolderSpec = 13;\n"
        f"\t\t\tfiles = (\n"
        + "".join(f"\t\t\t\t{embed_exts[n]},\n" for n in EXT_PRODUCTS)
        + "\t\t\t);\n"
        f"\t\t\tname = \"Embed Foundation Extensions\";\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n"
        f"\t\t}};"
    )

    # Target dependencies
    proxies = []
    deps = []
    dep_ids_for_app = []
    for name in ["ParentLockShared", *EXT_PRODUCTS]:
        proxy = uid("proxy", name)
        dep = uid("dep", "ParentLock", name)
        proxies.append(
            f"\t\t{proxy} /* PBXContainerItemProxy */ = {{\n"
            f"\t\t\tisa = PBXContainerItemProxy;\n"
            f"\t\t\tcontainerPortal = {uid('project')} /* Project object */;\n"
            f"\t\t\tproxyType = 1;\n"
            f"\t\t\tremoteGlobalIDString = {uid('target', name)};\n"
            f"\t\t\tremoteInfo = {name};\n"
            f"\t\t}};"
        )
        deps.append(
            f"\t\t{dep} /* PBXTargetDependency */ = {{\n"
            f"\t\t\tisa = PBXTargetDependency;\n"
            f"\t\t\ttarget = {uid('target', name)} /* {name} */;\n"
            f"\t\t\ttargetProxy = {proxy} /* PBXContainerItemProxy */;\n"
            f"\t\t}};"
        )
        dep_ids_for_app.append(dep)

    # Shared dependency for extensions
    ext_dep_ids = {}
    for name in EXT_PRODUCTS:
        proxy = uid("proxy", name, "shared")
        dep = uid("dep", name, "shared")
        proxies.append(
            f"\t\t{proxy} /* PBXContainerItemProxy */ = {{\n"
            f"\t\t\tisa = PBXContainerItemProxy;\n"
            f"\t\t\tcontainerPortal = {uid('project')} /* Project object */;\n"
            f"\t\t\tproxyType = 1;\n"
            f"\t\t\tremoteGlobalIDString = {uid('target', 'ParentLockShared')};\n"
            f"\t\t\tremoteInfo = ParentLockShared;\n"
            f"\t\t}};"
        )
        deps.append(
            f"\t\t{dep} /* PBXTargetDependency */ = {{\n"
            f"\t\t\tisa = PBXTargetDependency;\n"
            f"\t\t\ttarget = {uid('target', 'ParentLockShared')} /* ParentLockShared */;\n"
            f"\t\t\ttargetProxy = {proxy} /* PBXContainerItemProxy */;\n"
            f"\t\t}};"
        )
        ext_dep_ids[name] = [dep]

    def config_list(name: str, debug: dict, release: dict) -> tuple[str, list[str]]:
        d_id = uid("xcconfig", name, "debug")
        r_id = uid("xcconfig", name, "release")
        list_id = uid("xclist", name)
        blocks = [
            f"\t\t{d_id} /* Debug */ = {{\n"
            f"\t\t\tisa = XCBuildConfiguration;\n"
            + settings_block(debug).replace("\t\t\t\t", "\t\t\t")
            + "\n"
            f'\t\t\tname = Debug;\n'
            f"\t\t}};",
            f"\t\t{r_id} /* Release */ = {{\n"
            f"\t\t\tisa = XCBuildConfiguration;\n"
            + settings_block(release).replace("\t\t\t\t", "\t\t\t")
            + "\n"
            f'\t\t\tname = Release;\n'
            f"\t\t}};",
            f"\t\t{list_id} /* Build configuration list for {name} */ = {{\n"
            f"\t\t\tisa = XCConfigurationList;\n"
            f"\t\t\tbuildConfigurations = (\n"
            f"\t\t\t\t{d_id} /* Debug */,\n"
            f"\t\t\t\t{r_id} /* Release */,\n"
            f"\t\t\t);\n"
            f"\t\t\tdefaultConfigurationIsVisible = 0;\n"
            f"\t\t\tdefaultConfigurationName = Release;\n"
            f"\t\t}};",
        ]
        return list_id, blocks

    project_debug = build_settings("debug")
    project_release = build_settings("release")
    project_list, project_cfgs = config_list("PBXProject", project_debug, project_release)

    shared_extra = {
        "PRODUCT_BUNDLE_IDENTIFIER": "com.parentlock.shared",
        "PRODUCT_NAME": "ParentLockShared",
        "GENERATE_INFOPLIST_FILE": "YES",
        "DEFINES_MODULE": "YES",
        "SKIP_INSTALL": "YES",
        "APPLICATION_EXTENSION_API_ONLY": "YES",
        "DYLIB_COMPATIBILITY_VERSION": "1",
        "DYLIB_CURRENT_VERSION": "1",
        "DYLIB_INSTALL_NAME_BASE": "@rpath",
        "INSTALL_PATH": "$(LOCAL_LIBRARY_DIR)/Frameworks",
        "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks @loader_path/Frameworks",
        "CODE_SIGN_ENTITLEMENTS": "ParentLockShared/ParentLockShared.entitlements",
        "MACH_O_TYPE": "mh_dylib",
    }
    shared_list, shared_cfgs = config_list(
        "ParentLockShared",
        build_settings("debug", shared_extra),
        build_settings("release", shared_extra),
    )

    app_extra = {
        "PRODUCT_BUNDLE_IDENTIFIER": "com.parentlock.app",
        "PRODUCT_NAME": "ParentLock",
        "INFOPLIST_FILE": "ParentLock/Resources/Info.plist",
        "CODE_SIGN_ENTITLEMENTS": "ParentLock/Resources/ParentLock.entitlements",
        "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
        "GENERATE_INFOPLIST_FILE": "NO",
        "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks",
        "SUPPORTS_MACCATALYST": "NO",
    }
    app_list, app_cfgs = config_list(
        "ParentLock",
        build_settings("debug", app_extra),
        build_settings("release", app_extra),
    )

    ext_cfg_lists = {}
    ext_cfg_blocks = []
    for name, product in EXT_PRODUCTS.items():
        extra = {
            "PRODUCT_BUNDLE_IDENTIFIER": {
                "ParentLockMonitor": "com.parentlock.app.monitor",
                "ParentLockShieldConfig": "com.parentlock.app.shieldconfig",
                "ParentLockShieldAction": "com.parentlock.app.shieldaction",
                "ParentLockNotificationService": "com.parentlock.app.notificationservice",
            }[name],
            "PRODUCT_NAME": name,
            "INFOPLIST_FILE": f"{name}/Info.plist",
            "CODE_SIGN_ENTITLEMENTS": {
                "ParentLockMonitor": "ParentLockMonitor/ParentLockMonitor.entitlements",
                "ParentLockShieldConfig": "ParentLockShieldConfig/ParentLockShieldConfig.entitlements",
                "ParentLockShieldAction": "ParentLockShieldAction/ParentLockShieldAction.entitlements",
                "ParentLockNotificationService": "ParentLockNotificationService/ParentLockNotificationService.entitlements",
            }[name],
            "GENERATE_INFOPLIST_FILE": "NO",
            "APPLICATION_EXTENSION_API_ONLY": "YES",
            "SKIP_INSTALL": "YES",
            "LD_RUNPATH_SEARCH_PATHS": "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
        }
        lst, blocks = config_list(name, build_settings("debug", extra), build_settings("release", extra))
        ext_cfg_lists[name] = lst
        ext_cfg_blocks.extend(blocks)

    targets = []

    def native_target(
        name: str,
        product_type: str,
        product_ref: str,
        product_name: str,
        build_phases: list[str],
        dependencies: list[str],
        cfg_list: str,
        package_product_ids: list[str] | None = None,
    ) -> str:
        tid = uid("target", name)
        package_line = ""
        if package_product_ids:
            package_line = (
                "\t\t\tpackageProductDependencies = (\n"
                + "".join(f"\t\t\t\t{i},\n" for i in package_product_ids)
                + "\t\t\t);\n"
            )
        return (
            f"\t\t{tid} /* {name} */ = {{\n"
            f"\t\t\tisa = PBXNativeTarget;\n"
            f"\t\t\tbuildConfigurationList = {cfg_list};\n"
            f"\t\t\tbuildPhases = (\n"
            + "".join(f"\t\t\t\t{p},\n" for p in build_phases)
            + "\t\t\t);\n"
            f"\t\t\tbuildRules = (\n"
            f"\t\t\t);\n"
            f"\t\t\tdependencies = (\n"
            + "".join(f"\t\t\t\t{d},\n" for d in dependencies)
            + "\t\t\t);\n"
            f"\t\t\tname = {name};\n"
            + package_line
            + f"\t\t\tproductName = {name};\n"
            f"\t\t\tproductReference = {product_ref};\n"
            f"\t\t\tproductType = \"{product_type}\";\n"
            f"\t\t}};"
        )

    targets.append(
        native_target(
            "ParentLockShared",
            "com.apple.product-type.framework",
            products["ParentLockShared"],
            FRAMEWORK_PRODUCT,
            [source_phases["ParentLockShared"], framework_phases["ParentLockShared"]],
            [],
            shared_list,
        )
    )
    targets.append(
        native_target(
            "ParentLock",
            "com.apple.product-type.application",
            products["ParentLock"],
            APP_PRODUCT,
            [
                source_phases["ParentLock"],
                framework_phases["ParentLock"],
                resources_phase,
                embed_fw_phase,
                embed_ext_phase,
            ],
            dep_ids_for_app,
            app_list,
            list(product_deps.values()),
        )
    )
    for name in EXT_PRODUCTS:
        targets.append(
            native_target(
                name,
                "com.apple.product-type.app-extension",
                products[name],
                EXT_PRODUCTS[name],
                [source_phases[name], framework_phases[name]],
                ext_dep_ids[name],
                ext_cfg_lists[name],
            )
        )

    # Scheme
    scheme_dir = PROJECT / "xcshareddata/xcschemes"
    scheme_dir.mkdir(parents=True, exist_ok=True)
    (scheme_dir / "ParentLock.xcscheme").write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1540" version="1.7">
   <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
      <BuildActionEntries>
         <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">
            <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid('target', 'ParentLock')}" BuildableName="ParentLock.app" BlueprintName="ParentLock" ReferencedContainer="container:ParentLock.xcodeproj"/>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"/>
   <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">
      <BuildableProductRunnable runnableDebuggingMode="0">
         <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid('target', 'ParentLock')}" BuildableName="ParentLock.app" BlueprintName="ParentLock" ReferencedContainer="container:ParentLock.xcodeproj"/>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES">
      <BuildableProductRunnable runnableDebuggingMode="0">
         <BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{uid('target', 'ParentLock')}" BuildableName="ParentLock.app" BlueprintName="ParentLock" ReferencedContainer="container:ParentLock.xcodeproj"/>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction buildConfiguration="Debug"/>
   <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
""",
        encoding="utf-8",
    )

    package_products_block = []
    for product, pid in product_deps.items():
        package_products_block.append(
            f"\t\t{pid} /* {product} */ = {{\n"
            f"\t\t\tisa = XCSwiftPackageProductDependency;\n"
            f"\t\t\tpackage = {package_ref} /* firebase-ios-sdk */;\n"
            f"\t\t\tproductName = {product};\n"
            f"\t\t}};"
        )

    project_id = uid("project")
    pbx = []
    pbx.append("// !$*UTF8*$!")
    pbx.append("{")
    pbx.append("\tarchiveVersion = 1;")
    pbx.append("\tclasses = {")
    pbx.append("\t};")
    pbx.append("\tobjectVersion = 56;")
    pbx.append("\tobjects = {")
    pbx.append("")
    pbx.append("/* Begin PBXBuildFile section */")
    pbx.extend(build_files)
    pbx.append("/* End PBXBuildFile section */")
    pbx.append("")
    pbx.append("/* Begin PBXContainerItemProxy section */")
    pbx.extend(proxies)
    pbx.append("/* End PBXContainerItemProxy section */")
    pbx.append("")
    pbx.append("/* Begin PBXCopyFilesBuildPhase section */")
    pbx.extend([p for p in phases if "PBXCopyFilesBuildPhase" in p])
    pbx.append("/* End PBXCopyFilesBuildPhase section */")
    pbx.append("")
    pbx.append("/* Begin PBXFileReference section */")
    pbx.extend(file_refs)
    pbx.append("/* End PBXFileReference section */")
    pbx.append("")
    pbx.append("/* Begin PBXFrameworksBuildPhase section */")
    pbx.extend([p for p in phases if "PBXFrameworksBuildPhase" in p])
    pbx.append("/* End PBXFrameworksBuildPhase section */")
    pbx.append("")
    pbx.append("/* Begin PBXGroup section */")
    pbx.extend(groups)
    pbx.append("/* End PBXGroup section */")
    pbx.append("")
    pbx.append("/* Begin PBXNativeTarget section */")
    pbx.extend(targets)
    pbx.append("/* End PBXNativeTarget section */")
    pbx.append("")
    pbx.append("/* Begin PBXProject section */")
    pbx.append(f"\t\t{project_id} /* Project object */ = {{")
    pbx.append("\t\t\tisa = PBXProject;")
    pbx.append("\t\t\tattributes = {")
    pbx.append("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    pbx.append('\t\t\t\tLastSwiftUpdateCheck = 1540;')
    pbx.append("\t\t\t\tLastUpgradeCheck = 1540;")
    pbx.append("\t\t\t};")
    pbx.append(f"\t\t\tbuildConfigurationList = {project_list};")
    pbx.append('\t\t\tcompatibilityVersion = "Xcode 14.0";')
    pbx.append("\t\t\tdevelopmentRegion = en;")
    pbx.append("\t\t\thasScannedForEncodings = 0;")
    pbx.append("\t\t\tknownRegions = (")
    pbx.append("\t\t\t\ten,")
    pbx.append("\t\t\t\tBase,")
    pbx.append("\t\t\t);")
    pbx.append(f"\t\t\tmainGroup = {main_group};")
    pbx.append(f"\t\t\tpackageReferences = (")
    pbx.append(f"\t\t\t\t{package_ref} /* firebase-ios-sdk */,")
    pbx.append("\t\t\t);")
    pbx.append(f"\t\t\tproductRefGroup = {products_group};")
    pbx.append('\t\t\tprojectDirPath = "";')
    pbx.append('\t\t\tprojectRoot = "";')
    pbx.append("\t\t\ttargets = (")
    for name in ["ParentLock", "ParentLockShared", *EXT_PRODUCTS]:
        pbx.append(f"\t\t\t\t{uid('target', name)} /* {name} */,")
    pbx.append("\t\t\t);")
    pbx.append("\t\t};")
    pbx.append("/* End PBXProject section */")
    pbx.append("")
    pbx.append("/* Begin PBXResourcesBuildPhase section */")
    pbx.extend([p for p in phases if "PBXResourcesBuildPhase" in p])
    pbx.append("/* End PBXResourcesBuildPhase section */")
    pbx.append("")
    pbx.append("/* Begin PBXSourcesBuildPhase section */")
    pbx.extend([p for p in phases if "PBXSourcesBuildPhase" in p])
    pbx.append("/* End PBXSourcesBuildPhase section */")
    pbx.append("")
    pbx.append("/* Begin PBXTargetDependency section */")
    pbx.extend(deps)
    pbx.append("/* End PBXTargetDependency section */")
    pbx.append("")
    pbx.append("/* Begin XCBuildConfiguration section */")
    pbx.extend(project_cfgs[:2] + shared_cfgs[:2] + app_cfgs[:2] + [b for b in ext_cfg_blocks if "XCBuildConfiguration" in b and "XCConfigurationList" not in b])
    pbx.append("/* End XCBuildConfiguration section */")
    pbx.append("")
    pbx.append("/* Begin XCConfigurationList section */")
    pbx.extend([b for b in project_cfgs + shared_cfgs + app_cfgs + ext_cfg_blocks if "XCConfigurationList" in b])
    pbx.append("/* End XCConfigurationList section */")
    pbx.append("")
    pbx.append("/* Begin XCRemoteSwiftPackageReference section */")
    pbx.append(f"\t\t{package_ref} /* firebase-ios-sdk */ = {{")
    pbx.append("\t\t\tisa = XCRemoteSwiftPackageReference;")
    pbx.append('\t\t\trepositoryURL = "https://github.com/firebase/firebase-ios-sdk";')
    pbx.append("\t\t\trequirement = {")
    pbx.append("\t\t\t\tkind = upToNextMajorVersion;")
    pbx.append("\t\t\t\tminimumVersion = 11.0.0;")
    pbx.append("\t\t\t};")
    pbx.append("\t\t};")
    pbx.append("/* End XCRemoteSwiftPackageReference section */")
    pbx.append("")
    pbx.append("/* Begin XCSwiftPackageProductDependency section */")
    pbx.extend(package_products_block)
    pbx.append("/* End XCSwiftPackageProductDependency section */")
    pbx.append("\t};")
    pbx.append(f"\trootObject = {project_id} /* Project object */;")
    pbx.append("}")

    PROJECT.mkdir(parents=True, exist_ok=True)
    out = PROJECT / "project.pbxproj"
    out.write_text("\n".join(pbx) + "\n", encoding="utf-8")
    print(f"Wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
