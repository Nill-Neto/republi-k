"use client";

import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { LayoutDashboard, LogOut, Orbit, Settings, UserCog } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function SidebarDemo() {
  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: (
        <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: <UserCog className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
    {
      label: "Logout",
      href: "/login",
      icon: <LogOut className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />,
    },
  ];

  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "mx-auto flex h-[60vh] w-full max-w-7xl flex-1 flex-col overflow-hidden rounded-md border border-neutral-200 bg-gray-100 md:flex-row dark:border-neutral-700 dark:bg-neutral-800",
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <SidebarLink key={idx} link={link} />
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Housemate",
                href: "/profile",
                icon: (
                  <img
                    src="https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=100&q=80"
                    className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
                    width={50}
                    height={50}
                    alt="Avatar"
                  />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
      <Dashboard />
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      to="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <Orbit className="h-6 w-6 rounded-md bg-black p-1 text-white dark:bg-white dark:text-black" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="whitespace-pre font-medium text-black dark:text-white"
      >
        Republi-k
      </motion.span>
    </Link>
  );
};

export const LogoIcon = () => {
  return (
    <Link
      to="/"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black"
    >
      <Orbit className="h-6 w-6 rounded-md bg-black p-1 text-white dark:bg-white dark:text-black" />
    </Link>
  );
};

const Dashboard = () => {
  return (
    <div className="flex flex-1">
      <div className="flex h-full w-full flex-1 flex-col gap-2 rounded-tl-2xl border border-neutral-200 bg-white p-2 md:p-10 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex gap-2">
          {[...new Array(4)].map((_, i) => (
            <div
              key={`first-array-${i}`}
              className="h-20 w-full animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800"
            />
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          {[...new Array(2)].map((_, i) => (
            <div
              key={`second-array-${i}`}
              className="h-full w-full animate-pulse rounded-lg bg-gray-100 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
