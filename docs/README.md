# LSP-Toy Documentation

Welcome to the LSP-Toy documentation! This guide covers the embedded language aggregation system and tree visualization features.

## 📚 Quick Start

- **[Main README](../README.md)** - Project overview and getting started
- **[Architecture](ARCHITECTURE.md)** - System architecture and design
- **[Architecture Diagrams](ARCHITECTURE_DIAGRAMS.md)** - Visual system diagrams

## 🚀 Features

- **[Embedded Language Support](features/EMBEDDED_PHASE1.md)** - Main feature documentation
- **[Embedded Quick Reference](features/EMBEDDED_QUICK_REF.md)** - Quick usage guide
- **[Tree Outline Visualization](features/TREE_OUTLINE_FEATURE.md)** - Document tree debugging
- **[Hover Hints System](features/HOVER_HINTS.md)** - Contextual help for missing servers

## 🛠️ Development

- **[Phase 1 Complete](development/PHASE1_COMPLETE.md)** - Implementation summary
- **[Phase 2 Roadmap](development/PHASE2_ROADMAP.md)** - Future development plans
- **[Testing Checklist](development/TESTING_CHECKLIST.md)** - Manual testing guide
- **[Implementation Summary](development/IMPLEMENTATION_SUMMARY.md)** - Technical details
- **[Enhanced Debug Logging](development/ENHANCED_DEBUG_LOGGING.md)** - Debug features

## 🔧 Troubleshooting

- **[Language Server Setup](troubleshooting/LANGUAGE_SERVER_SETUP.md)** - Installing language servers
- **[Spawn Failure Hints](troubleshooting/SPAWN_FAILURE_HINTS.md)** - Fixing server startup issues
- **[Logging Cleanup](troubleshooting/LOGGING_CLEANUP.md)** - Debug output management
- **[Fix Guides](troubleshooting/)** - Various bug fixes and solutions

## 📖 Additional Resources

- **[Migration Guide](development/MIGRATION_GUIDE.md)** - Upgrading from earlier versions
- **[Grammar Notes](../GRAMMAR_NOTES.md)** - Tree-sitter grammar information
- **[Sample Files](../samples/)** - Example `.lsptoy` documents

## 🎯 Key Components

### Embedded Language System
The core feature that enables LSP-Toy to aggregate multiple language servers within Markdown code fences:

- **Registry**: 10+ language definitions with runtime selection
- **Manager**: Lifecycle management, request forwarding, position mapping
- **Virtual Documents**: Isolated contexts for each code fence
- **Position Mapping**: Coordinate translation between host and embedded documents

### Tree Visualization
Advanced debugging tools for understanding document structure:

- **Hover Outline**: Quick tree view on line 1 hover
- **Detailed Logging**: Complete tree with line-by-line content mapping
- **Debug Features**: Position ranges, node types, content excerpts

### User Experience
- **Contextual Hints**: Installation suggestions for missing language servers
- **Typo Correction**: Smart suggestions (e.g., `ts` → `typescript`)
- **Clean Logging**: Minimal noise, maximum signal
- **Graceful Degradation**: Works even when language servers fail

## 🚀 What's Next?

Check out [Phase 2 Roadmap](development/PHASE2_ROADMAP.md) for upcoming features:
- Document symbols aggregation
- Signature help forwarding
- Workspace configuration
- Automated testing
- Performance optimizations

---

**Need Help?** Check the troubleshooting guides or open an issue on GitHub!